//! nt-d3d12 — hôte natif Direct3D 12 du noyau nt (docs/plan/03-design-systeme.md §4.1).
//! Swapchain 4K flip-discard ×3, tearing, waitable (latence 1), Agility SDK 1.620, timestamps GPU.
//! Usage : `nt-d3d12 [--bench N] [--particles N] [--vsync]`
//! Banc : JSON sur stdout ; `presentMs*` = intervalles entre deux Present (cadence réellement affichée en `--vsync`),
//! `late` = intervalles > 1,5 × médiane (vblank manqué).
#![allow(non_upper_case_globals)]

#[cfg(not(windows))]
fn main() {
    eprintln!("nt-d3d12 : Windows uniquement");
}

#[cfg(windows)]
fn main() -> windows::core::Result<()> {
    host::run()
}

/// Agility SDK : exports lus par `d3d12.dll` (Learn « `D3D12SDKVersion` symbol »). 620 = `D3D12_SDK_VERSION`
/// du paquet `Microsoft.Direct3D.D3D12` 1.620.2.
#[cfg(windows)]
#[unsafe(no_mangle)]
#[used]
pub static D3D12SDKVersion: u32 = 620;

#[cfg(windows)]
#[repr(transparent)]
pub struct SdkPath(*const core::ffi::c_char);
// SAFETY: pointeur vers une chaîne statique immuable.
#[cfg(windows)]
unsafe impl Sync for SdkPath {}
#[cfg(windows)]
#[unsafe(no_mangle)]
#[used]
pub static D3D12SDKPath: SdkPath = SdkPath(c".\\D3D12\\".as_ptr());

#[cfg(windows)]
#[allow(clippy::wildcard_imports, clippy::borrow_as_ptr, clippy::cast_ptr_alignment)] // FFI D3D12 : API à pointeurs bruts, modèle du sample windows-rs
mod host {
    use nt_kernel::{Instance, Kernel, MAX_INSTANCES, input};
    use std::{alloc::Layout, cell::RefCell, mem::ManuallyDrop, rc::Rc, time::Instant};
    use windows::{Win32::*, core::*};
    use windows_window::{Window, quit, run_with};

    const W: u32 = 3840;
    const H: u32 = 2160;
    const FRAMES: usize = 3;
    const STRIDE: usize = core::mem::size_of::<Instance>();
    const SLICE: usize = MAX_INSTANCES * STRIDE;
    static VS: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/vs.dxil"));
    static PS: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/ps.dxil"));

    struct Opts {
        bench: u32,
        particles: u32,
        vsync: bool,
    }

    fn opts() -> Opts {
        let a: Vec<String> = std::env::args().collect();
        let val = |k: &str, d: u32| a.iter().position(|x| x == k).and_then(|i| a.get(i + 1)).and_then(|v| v.parse().ok()).unwrap_or(d);
        Opts { bench: val("--bench", 0), particles: val("--particles", 10_000), vsync: a.iter().any(|x| x == "--vsync") }
    }

    /// `Kernel::ZERO` ne contient que des bits nuls : allocation à zéro directement sur le tas
    /// (évite ~640 Kio sur la pile principale de 1 Mio).
    fn new_kernel() -> Box<Kernel> {
        let layout = Layout::new::<Kernel>();
        // SAFETY: layout non nul ; Kernel::ZERO = tous bits à zéro (floats 0.0, bools false, entiers 0).
        unsafe {
            let p = std::alloc::alloc_zeroed(layout).cast::<Kernel>();
            assert!(!p.is_null());
            Box::from_raw(p)
        }
    }

    struct Gpu {
        queue: ID3D12CommandQueue,
        swap: IDXGISwapChain3,
        waitable: HANDLE,
        /// Tas RTV conservé : `rtv_start` pointe dans sa mémoire (le libérer rend les descripteurs invalides).
        _rtv_heap: ID3D12DescriptorHeap,
        rtv_start: usize,
        rtv_size: usize,
        targets: [ID3D12Resource; FRAMES],
        allocs: [ID3D12CommandAllocator; FRAMES],
        list: ID3D12GraphicsCommandList,
        root: ID3D12RootSignature,
        pso: ID3D12PipelineState,
        inst: ID3D12Resource,
        inst_ptr: *mut u8,
        qheap: ID3D12QueryHeap,
        readback: ID3D12Resource,
        rb_ptr: *const u64,
        ts_period_ms: f64,
        fence: ID3D12Fence,
        fence_values: [u64; FRAMES],
        next_fence: u64,
        event: HANDLE,
        tearing: bool,
        adapter: String,
    }

    fn buffer(device: &ID3D12Device, heap: D3D12_HEAP_TYPE, size: usize, state: D3D12_RESOURCE_STATES) -> Result<ID3D12Resource> {
        let mut r: Option<ID3D12Resource> = None;
        // SAFETY: descripteurs valides, sortie dans `r`.
        unsafe {
            device.CreateCommittedResource(
                &D3D12_HEAP_PROPERTIES { Type: heap, ..Default::default() },
                D3D12_HEAP_FLAG_NONE,
                &D3D12_RESOURCE_DESC {
                    Dimension: D3D12_RESOURCE_DIMENSION_BUFFER,
                    Width: size as u64,
                    Height: 1,
                    DepthOrArraySize: 1,
                    MipLevels: 1,
                    SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
                    Layout: D3D12_TEXTURE_LAYOUT_ROW_MAJOR,
                    ..Default::default()
                },
                state,
                None,
                &mut r,
            )?;
        }
        Ok(r.unwrap())
    }

    fn transition(res: &ID3D12Resource, before: D3D12_RESOURCE_STATES, after: D3D12_RESOURCE_STATES) -> D3D12_RESOURCE_BARRIER {
        D3D12_RESOURCE_BARRIER {
            Type: D3D12_RESOURCE_BARRIER_TYPE_TRANSITION,
            Flags: D3D12_RESOURCE_BARRIER_FLAG_NONE,
            Anonymous: D3D12_RESOURCE_BARRIER_0 {
                Transition: ManuallyDrop::new(D3D12_RESOURCE_TRANSITION_BARRIER {
                    // SAFETY: copie non comptée du pointeur COM, la ressource vit plus longtemps que la barrière.
                    pResource: unsafe { std::mem::transmute_copy(res) },
                    StateBefore: before,
                    StateAfter: after,
                    Subresource: D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES,
                }),
            },
        }
    }

    #[allow(clippy::too_many_lines)]
    fn init(hwnd: HWND) -> Result<Gpu> {
        // SAFETY: appels D3D12/DXGI documentés, objets COM gérés par windows-core.
        unsafe {
            let factory: IDXGIFactory6 = CreateDXGIFactory2(0)?;
            let adapter: IDXGIAdapter1 = factory.EnumAdapterByGpuPreference(0, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE)?;
            let mut ad = DXGI_ADAPTER_DESC1::default();
            adapter.GetDesc1(&mut ad).ok()?;
            let name = String::from_utf16_lossy(&ad.Description[..ad.Description.iter().position(|&c| c == 0).unwrap_or(128)]);
            let mut device: Option<ID3D12Device> = None;
            D3D12CreateDevice(&adapter, D3D_FEATURE_LEVEL_12_0, &mut device)?;
            let device = device.unwrap();

            let queue: ID3D12CommandQueue = device.CreateCommandQueue(&D3D12_COMMAND_QUEUE_DESC { Type: D3D12_COMMAND_LIST_TYPE_DIRECT, ..Default::default() })?;
            let f5: IDXGIFactory5 = factory.cast()?;
            let mut allow: i32 = 0;
            let tearing = f5
                .CheckFeatureSupport(DXGI_FEATURE_PRESENT_ALLOW_TEARING, (&raw mut allow).cast(), 4)
                .is_ok()
                && allow != 0;
            let flags = DXGI_SWAP_CHAIN_FLAG_FRAME_LATENCY_WAITABLE_OBJECT | if tearing { DXGI_SWAP_CHAIN_FLAG_ALLOW_TEARING } else { 0 };
            let desc = DXGI_SWAP_CHAIN_DESC1 {
                Width: W,
                Height: H,
                Format: DXGI_FORMAT_B8G8R8A8_UNORM,
                SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
                BufferUsage: DXGI_USAGE_RENDER_TARGET_OUTPUT,
                BufferCount: FRAMES as u32,
                Scaling: DXGI_SCALING_STRETCH,
                SwapEffect: DXGI_SWAP_EFFECT_FLIP_DISCARD,
                Flags: flags as _,
                ..Default::default()
            };
            let swap: IDXGISwapChain3 = factory.CreateSwapChainForHwnd(&queue, hwnd, &desc, None, None)?.cast()?;
            factory.MakeWindowAssociation(hwnd, DXGI_MWA_NO_ALT_ENTER as u32).ok()?;
            let swap2: IDXGISwapChain2 = swap.cast()?;
            swap2.SetMaximumFrameLatency(1).ok()?;
            let waitable = swap2.GetFrameLatencyWaitableObject();

            let rtv_heap: ID3D12DescriptorHeap =
                device.CreateDescriptorHeap(&D3D12_DESCRIPTOR_HEAP_DESC { NumDescriptors: FRAMES as u32, Type: D3D12_DESCRIPTOR_HEAP_TYPE_RTV, ..Default::default() })?;
            let rtv_size = device.GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV) as usize;
            let rtv_start = rtv_heap.GetCPUDescriptorHandleForHeapStart().ptr;
            let target = |i: usize| -> Result<ID3D12Resource> {
                let r: ID3D12Resource = swap.GetBuffer(i as u32)?;
                device.CreateRenderTargetView(&r, None, D3D12_CPU_DESCRIPTOR_HANDLE { ptr: rtv_start + i * rtv_size });
                Ok(r)
            };
            let targets = [target(0)?, target(1)?, target(2)?];
            let alloc = || device.CreateCommandAllocator::<ID3D12CommandAllocator>(D3D12_COMMAND_LIST_TYPE_DIRECT);
            let allocs = [alloc()?, alloc()?, alloc()?];

            let root: ID3D12RootSignature = device.CreateRootSignature(0, VS.as_ptr().cast(), VS.len())?;
            let blend = D3D12_RENDER_TARGET_BLEND_DESC {
                BlendEnable: true.into(),
                LogicOpEnable: false.into(),
                SrcBlend: D3D12_BLEND_ONE,
                DestBlend: D3D12_BLEND_INV_SRC_ALPHA,
                BlendOp: D3D12_BLEND_OP_ADD,
                SrcBlendAlpha: D3D12_BLEND_ONE,
                DestBlendAlpha: D3D12_BLEND_INV_SRC_ALPHA,
                BlendOpAlpha: D3D12_BLEND_OP_ADD,
                LogicOp: D3D12_LOGIC_OP_NOOP,
                RenderTargetWriteMask: D3D12_COLOR_WRITE_ENABLE_ALL as u8,
            };
            let mut pso_desc = D3D12_GRAPHICS_PIPELINE_STATE_DESC {
                pRootSignature: std::mem::transmute_copy(&root),
                VS: D3D12_SHADER_BYTECODE { pShaderBytecode: VS.as_ptr().cast(), BytecodeLength: VS.len() },
                PS: D3D12_SHADER_BYTECODE { pShaderBytecode: PS.as_ptr().cast(), BytecodeLength: PS.len() },
                RasterizerState: D3D12_RASTERIZER_DESC { FillMode: D3D12_FILL_MODE_SOLID, CullMode: D3D12_CULL_MODE_NONE, ..Default::default() },
                BlendState: D3D12_BLEND_DESC { RenderTarget: [blend, D3D12_RENDER_TARGET_BLEND_DESC::default(), D3D12_RENDER_TARGET_BLEND_DESC::default(), D3D12_RENDER_TARGET_BLEND_DESC::default(), D3D12_RENDER_TARGET_BLEND_DESC::default(), D3D12_RENDER_TARGET_BLEND_DESC::default(), D3D12_RENDER_TARGET_BLEND_DESC::default(), D3D12_RENDER_TARGET_BLEND_DESC::default()], ..Default::default() },
                SampleMask: u32::MAX,
                PrimitiveTopologyType: D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE,
                NumRenderTargets: 1,
                SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
                ..Default::default()
            };
            pso_desc.RTVFormats[0] = DXGI_FORMAT_B8G8R8A8_UNORM;
            let pso: ID3D12PipelineState = device.CreateGraphicsPipelineState(&pso_desc)?;
            let list: ID3D12GraphicsCommandList = device.CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, &allocs[0], &pso)?;
            list.Close().ok()?;

            let inst = buffer(&device, D3D12_HEAP_TYPE_UPLOAD, SLICE * FRAMES, D3D12_RESOURCE_STATE_GENERIC_READ)?;
            let mut p = std::ptr::null_mut();
            inst.Map(0, None, Some(&mut p)).ok()?;
            let mut qheap: Option<ID3D12QueryHeap> = None;
            device.CreateQueryHeap(&D3D12_QUERY_HEAP_DESC { Type: D3D12_QUERY_HEAP_TYPE_TIMESTAMP, Count: (FRAMES * 2) as u32, NodeMask: 0 }, &mut qheap)?;
            let readback = buffer(&device, D3D12_HEAP_TYPE_READBACK, FRAMES * 16, D3D12_RESOURCE_STATE_COPY_DEST)?;
            let mut rb = std::ptr::null_mut();
            readback.Map(0, None, Some(&mut rb)).ok()?;
            let mut freq = 0u64;
            queue.GetTimestampFrequency(&mut freq).ok()?;
            let fence: ID3D12Fence = device.CreateFence(0, D3D12_FENCE_FLAG_NONE)?;
            let event = CreateEventW(None, false, false, None);
            Ok(Gpu {
                queue,
                swap,
                waitable,
                _rtv_heap: rtv_heap,
                rtv_start,
                rtv_size,
                targets,
                allocs,
                list,
                root,
                pso,
                inst,
                inst_ptr: p.cast(),
                qheap: qheap.unwrap(),
                readback,
                rb_ptr: rb.cast(),
                ts_period_ms: 1000.0 / freq as f64,
                fence,
                fence_values: [0; FRAMES],
                next_fence: 1,
                event,
                tearing,
                adapter: name,
            })
        }
    }

    impl Gpu {
        /// Enregistre et soumet une frame ; renvoie le temps GPU (ms) de la frame qui réutilise ce slot.
        fn frame(&mut self, kernel: &Kernel, vsync: bool) -> Result<f64> {
            // SAFETY: synchronisation par fence avant toute réutilisation d'un slot (allocator, buffer d'instances, readback).
            unsafe {
                let i = self.swap.GetCurrentBackBufferIndex() as usize;
                if self.fence.GetCompletedValue() < self.fence_values[i] {
                    self.fence.SetEventOnCompletion(self.fence_values[i], self.event).ok()?;
                    WaitForSingleObject(self.event, u32::MAX);
                }
                let prev = *self.rb_ptr.add(i * 2);
                let prev_end = *self.rb_ptr.add(i * 2 + 1);
                let gpu_ms = if self.fence_values[i] > 0 && prev_end > prev { (prev_end - prev) as f64 * self.ts_period_ms } else { f64::NAN };

                let inst = kernel.instances();
                std::ptr::copy_nonoverlapping(inst.as_ptr().cast::<u8>(), self.inst_ptr.add(i * SLICE), inst.len() * STRIDE);

                let alloc = &self.allocs[i];
                alloc.Reset().ok()?;
                let l = &self.list;
                l.Reset(alloc, &self.pso).ok()?;
                l.EndQuery(&self.qheap, D3D12_QUERY_TYPE_TIMESTAMP, (i * 2) as u32);
                l.SetGraphicsRootSignature(&self.root);
                let consts = [2.0 / W as f32, 2.0 / H as f32, W as f32, H as f32];
                l.SetGraphicsRoot32BitConstants(0, 4, consts.as_ptr().cast(), 0);
                l.SetGraphicsRootShaderResourceView(1, self.inst.GetGPUVirtualAddress() + (i * SLICE) as u64);
                let vp = D3D12_VIEWPORT { TopLeftX: 0.0, TopLeftY: 0.0, Width: W as f32, Height: H as f32, MinDepth: 0.0, MaxDepth: 1.0 };
                l.RSSetViewports(1, &vp);
                l.RSSetScissorRects(1, &RECT { left: 0, top: 0, right: W as i32, bottom: H as i32 });
                let target = &self.targets[i];
                l.ResourceBarrier(1, &transition(target, D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET));
                let rtv = D3D12_CPU_DESCRIPTOR_HANDLE { ptr: self.rtv_start + i * self.rtv_size };
                l.OMSetRenderTargets(1, Some(&rtv), false, None);
                l.ClearRenderTargetView(rtv, [0.0_f32, 0.0, 0.0, 1.0].as_ptr(), 0, core::ptr::null());
                l.IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP as D3D12_PRIMITIVE_TOPOLOGY);
                l.DrawInstanced(4, inst.len() as u32, 0, 0);
                l.ResourceBarrier(1, &transition(target, D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PRESENT));
                l.EndQuery(&self.qheap, D3D12_QUERY_TYPE_TIMESTAMP, (i * 2 + 1) as u32);
                l.ResolveQueryData(&self.qheap, D3D12_QUERY_TYPE_TIMESTAMP, (i * 2) as u32, 2, &self.readback, (i * 16) as u64);
                l.Close().ok()?;
                let cmd = Some(l.cast::<ID3D12CommandList>()?);
                self.queue.ExecuteCommandLists(1, &cmd);
                let (sync, flags) = if vsync || !self.tearing { (1, 0) } else { (0, DXGI_PRESENT_ALLOW_TEARING) };
                self.swap.Present(sync, flags).ok()?;
                self.queue.Signal(&self.fence, self.next_fence).ok()?;
                self.fence_values[i] = self.next_fence;
                self.next_fence += 1;
                Ok(gpu_ms)
            }
        }

        /// Attend la fin de tout le travail GPU soumis (avant destruction des ressources).
        fn flush(&self) {
            // SAFETY: fence et événement valides pour la durée de `Gpu`.
            unsafe {
                let last = self.next_fence.saturating_sub(1);
                if last > 0 && self.fence.GetCompletedValue() < last && self.fence.SetEventOnCompletion(last, self.event).is_ok() {
                    WaitForSingleObject(self.event, u32::MAX);
                }
            }
        }

        fn wait_latency(&self) {
            // SAFETY: handle waitable valide pour la durée de la swapchain.
            unsafe {
                WaitForSingleObjectEx(self.waitable, 1000, true);
            }
        }
    }

    impl Drop for Gpu {
        fn drop(&mut self) {
            self.flush();
        }
    }

    fn pct(v: &mut [f64], p: f64) -> f64 {
        v.sort_by(f64::total_cmp);
        v.get(((v.len() as f64 * p) as usize).min(v.len().saturating_sub(1))).copied().unwrap_or(f64::NAN)
    }

    pub fn run() -> Result<()> {
        let o = opts();
        let kernel = Rc::new(RefCell::new(new_kernel()));
        kernel.borrow_mut().boot(W as f32, H as f32, 0x5eed, o.particles);
        let client = Rc::new(RefCell::new((1920_i32, 1080_i32)));
        let (k2, c2) = (kernel.clone(), client.clone());
        let window = Window::new("nt — Direct3D 12")
            .client_size(1920, 1080)
            .on_resize(move |w, h| *c2.borrow_mut() = (w.max(1), h.max(1)))
            .on_message(move |_, msg, _, lparam| {
                let kind = match msg {
                    m if m == WM_MOUSEMOVE as u32 => input::MOVE,
                    m if m == WM_LBUTTONDOWN as u32 => input::DOWN,
                    m if m == WM_LBUTTONUP as u32 => input::UP,
                    _ => return None,
                };
                let (cw, ch) = *client.borrow();
                let x = f32::from((lparam & 0xFFFF) as u16 as i16) * W as f32 / cw as f32;
                let y = f32::from(((lparam >> 16) & 0xFFFF) as u16 as i16) * H as f32 / ch as f32;
                k2.borrow_mut().input(kind, x, y);
                Some(0)
            })
            .create()?;
        let mut gpu = init(window.hwnd() as HWND)?;
        eprintln!("nt-d3d12 : {} | swapchain {W}x{H} flip-discard x{FRAMES} | tearing={} | Agility SDK 620", gpu.adapter, gpu.tearing);

        let start = Instant::now();
        let mut cpu: Vec<f64> = Vec::with_capacity(o.bench as usize);
        let mut gpu_ms: Vec<f64> = Vec::with_capacity(o.bench as usize);
        let mut present_ms: Vec<f64> = Vec::with_capacity(o.bench as usize);
        let mut last_present = Instant::now();
        let mut frames = 0u32;
        let mut sim = 0.0f64;
        let mut last_report = Instant::now();
        let mut window_frames = 0u32;
        let bench = o.bench;
        run_with(move || {
            gpu.wait_latency();
            let t0 = Instant::now();
            let now = if bench > 0 {
                sim += 1000.0 / 120.0;
                sim
            } else {
                start.elapsed().as_secs_f64() * 1000.0
            };
            let n = kernel.borrow_mut().tick(now);
            if n == 0 && bench == 0 {
                return Ok(false);
            }
            let g = gpu.frame(&kernel.borrow(), o.vsync)?;
            frames += 1;
            window_frames += 1;
            if bench > 0 {
                let now_present = Instant::now();
                if frames > 1 {
                    present_ms.push((now_present - last_present).as_secs_f64() * 1000.0);
                }
                last_present = now_present;
                cpu.push(t0.elapsed().as_secs_f64() * 1000.0);
                if g.is_finite() {
                    gpu_ms.push(g);
                }
                if frames >= bench {
                    let wall = start.elapsed().as_secs_f64();
                    let present_p50 = pct(&mut present_ms, 0.5);
                    let late = present_ms.iter().filter(|&&x| x > 1.5 * present_p50).count();
                    println!(
                        "{{\"frames\":{frames},\"res\":\"{W}x{H}\",\"instances\":{n},\"adapter\":\"{}\",\"tearing\":{},\"wallFps\":{:.1},\"cpuMsP50\":{:.4},\"cpuMsP99\":{:.4},\"gpuMsP50\":{:.4},\"gpuMsP99\":{:.4},\"gpuMsMax\":{:.4},\"vsync\":{},\"presentMsP50\":{:.4},\"presentMsP99\":{:.4},\"presentMsMax\":{:.4},\"late\":{}}}",
                        gpu.adapter,
                        gpu.tearing,
                        f64::from(frames) / wall,
                        pct(&mut cpu, 0.5),
                        pct(&mut cpu, 0.99),
                        pct(&mut gpu_ms, 0.5),
                        pct(&mut gpu_ms, 0.99),
                        pct(&mut gpu_ms, 1.0),
                        o.vsync,
                        present_p50,
                        pct(&mut present_ms, 0.99),
                        pct(&mut present_ms, 1.0),
                        late
                    );
                    quit();
                    return Ok(false);
                }
            } else if last_report.elapsed().as_secs_f64() >= 1.0 {
                eprintln!("{:.1} fps | gpu {:.3} ms | {n} instances", f64::from(window_frames) / last_report.elapsed().as_secs_f64(), g);
                window_frames = 0;
                last_report = Instant::now();
            }
            Ok(true)
        })
    }
}
