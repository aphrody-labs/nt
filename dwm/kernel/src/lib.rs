//! nt-kernel — noyau partagé (navigateur wasm32 + natif). `no_std`, aucune allocation,
//! capacités fixes (docs/plan/03-design-systeme.md §2).
#![cfg_attr(not(test), no_std)]

pub const MAX_INSTANCES: usize = 12_288;
pub const MAX_WINDOWS: usize = 64;
pub const MAX_PARTICLES: usize = 10_000;

/// Instance de rendu (32 octets, `repr(C)`), lue telle quelle par WGSL et HLSL.
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Instance {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    /// RGBA8 (r = octet de poids faible).
    pub color: u32,
    pub radius: f32,
    /// > 0 : quad d'ombre douce de ce rayon.
    pub shadow: f32,
    /// bit 0 : dégradé de fond d'écran.
    pub flags: u32,
}

impl Instance {
    pub const ZERO: Self = Self { x: 0.0, y: 0.0, w: 0.0, h: 0.0, color: 0, radius: 0.0, shadow: 0.0, flags: 0 };
}

const _: () = assert!(core::mem::size_of::<Instance>() == 32);

/// Compteurs exposés à l'hôte (`nt_stats`).
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct Stats {
    pub instances: u32,
    pub windows: u32,
    pub particles: u32,
    pub ticks: u32,
    pub idle_ticks: u32,
}

#[derive(Clone, Copy)]
struct Window {
    generation: u16,
    alive: bool,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    accent: u32,
}

impl Window {
    const ZERO: Self = Self { generation: 0, alive: false, x: 0.0, y: 0.0, w: 0.0, h: 0.0, accent: 0 };
}

#[derive(Clone, Copy)]
struct Particle {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    size: f32,
    color: u32,
}

impl Particle {
    const ZERO: Self = Self { x: 0.0, y: 0.0, vx: 0.0, vy: 0.0, size: 0.0, color: 0 };
}

/// Handle = génération (12 bits) << 20 | index (20 bits). 0 = invalide.
pub type Handle = u32;
const INDEX_BITS: u32 = 20;

pub mod input {
    pub const MOVE: u32 = 0;
    pub const DOWN: u32 = 1;
    pub const UP: u32 = 2;
}

const PALETTE: [u32; 8] = [
    0xFF_D4_78_00, 0xFF_00_A4_EF, 0xFF_7F_BA_00, 0xFF_FF_B9_00, 0xFF_E8_11_23, 0xFF_88_17_98, 0xFF_00_B7_C3, 0xFF_F7_63_0C,
];
const WALL_TOP: u32 = 0xFF_5A_2A_0B; // bleu nuit (ABGR → RGBA little-endian : r=0x0B…)
const TASKBAR: u32 = 0xE6_20_20_20;
const WIN_BODY: u32 = 0xFF_2B_2B_2B;
const WIN_TITLE: u32 = 0xFF_20_20_20;
const LINE: u32 = 0xFF_3C_3C_3C;
const CLOSE: u32 = 0xFF_23_11_E8;

pub struct Kernel {
    w: f32,
    h: f32,
    s: f32,
    rng: u64,
    started: bool,
    last_ms: f64,
    dirty: bool,
    start_open: bool,
    drag: u32,
    drag_dx: f32,
    drag_dy: f32,
    wins: [Window; MAX_WINDOWS],
    z: [u8; MAX_WINDOWS],
    zn: usize,
    parts: [Particle; MAX_PARTICLES],
    pn: usize,
    inst: [Instance; MAX_INSTANCES],
    n: usize,
    stats: Stats,
}

impl Kernel {
    /// État initial constant : placé en `.bss`, aucun octet dans le binaire (jamais matérialisé sur la pile).
    #[allow(clippy::large_stack_arrays)]
    pub const ZERO: Self = Self {
        w: 0.0,
        h: 0.0,
        s: 0.0,
        rng: 0,
        started: false,
        last_ms: 0.0,
        dirty: false,
        start_open: false,
        drag: 0,
        drag_dx: 0.0,
        drag_dy: 0.0,
        wins: [Window::ZERO; MAX_WINDOWS],
        z: [0; MAX_WINDOWS],
        zn: 0,
        parts: [Particle::ZERO; MAX_PARTICLES],
        pn: 0,
        inst: [Instance::ZERO; MAX_INSTANCES],
        n: 0,
        stats: Stats { instances: 0, windows: 0, particles: 0, ticks: 0, idle_ticks: 0 },
    };

    pub fn boot(&mut self, width: f32, height: f32, seed: u32, particles: u32) {
        // Remise à zéro ciblée : pas de temporaire `Self::ZERO` (~640 Kio) sur la pile.
        for w in &mut self.wins {
            w.alive = false;
        }
        self.zn = 0;
        self.n = 0;
        self.started = false;
        self.last_ms = 0.0;
        self.dirty = false;
        self.start_open = false;
        self.drag = 0;
        self.stats = Stats::default();
        self.w = width;
        self.h = height;
        self.s = height / 1080.0;
        self.rng = u64::from(seed) | 1;
        let s = self.s;
        let top = self.h - self.taskbar_h();
        self.pn = (particles as usize).min(MAX_PARTICLES);
        for i in 0..self.pn {
            let size = (4.0 + self.rand() * 10.0) * s;
            self.parts[i] = Particle {
                x: self.rand() * (self.w - size),
                y: self.rand() * (top - size),
                vx: (self.rand() - 0.5) * 240.0 * s,
                vy: (self.rand() - 0.5) * 240.0 * s,
                size,
                color: (PALETTE[i % PALETTE.len()] & 0x00FF_FFFF) | 0xB0_00_00_00,
            };
        }
        for (i, (x, y, w, h)) in [(160.0, 120.0, 900.0, 560.0), (520.0, 260.0, 760.0, 480.0), (980.0, 180.0, 640.0, 420.0)].into_iter().enumerate() {
            self.window_create(x * s, y * s, w * s, h * s, PALETTE[i + 1]);
        }
        self.dirty = true;
    }

    fn taskbar_h(&self) -> f32 {
        48.0 * self.s
    }

    /// xorshift64* → [0, 1).
    fn rand(&mut self) -> f32 {
        let mut x = self.rng;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.rng = x;
        ((x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 40) as f32) / 16_777_216.0
    }

    pub fn window_create(&mut self, x: f32, y: f32, w: f32, h: f32, accent: u32) -> Handle {
        let Some(i) = self.wins.iter().position(|w| !w.alive) else { return 0 };
        let generation = (self.wins[i].generation.wrapping_add(1) & 0x0FFF).max(1);
        self.wins[i] = Window { generation, alive: true, x, y, w, h, accent };
        self.z[self.zn] = i as u8;
        self.zn += 1;
        self.dirty = true;
        (u32::from(generation) << INDEX_BITS) | i as u32
    }

    fn resolve(&self, h: Handle) -> Option<usize> {
        let i = (h & ((1 << INDEX_BITS) - 1)) as usize;
        let g = (h >> INDEX_BITS) as u16;
        (i < MAX_WINDOWS && self.wins[i].alive && self.wins[i].generation == g && g != 0).then_some(i)
    }

    pub fn window_close(&mut self, h: Handle) -> bool {
        let Some(i) = self.resolve(h) else { return false };
        self.wins[i].alive = false;
        if let Some(p) = self.z[..self.zn].iter().position(|&z| z as usize == i) {
            self.z.copy_within(p + 1..self.zn, p);
            self.zn -= 1;
        }
        self.dirty = true;
        true
    }

    fn handle_of(&self, i: usize) -> Handle {
        (u32::from(self.wins[i].generation) << INDEX_BITS) | i as u32
    }

    fn raise(&mut self, i: usize) {
        if let Some(p) = self.z[..self.zn].iter().position(|&z| z as usize == i) {
            self.z.copy_within(p + 1..self.zn, p);
            self.z[self.zn - 1] = i as u8;
        }
    }

    fn hit_window(&self, x: f32, y: f32) -> Option<usize> {
        self.z[..self.zn].iter().rev().map(|&z| z as usize).find(|&i| {
            let w = &self.wins[i];
            x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h
        })
    }

    fn taskbar_slot(&self, k: usize) -> (f32, f32, f32) {
        let s = self.s;
        let size = 40.0 * s;
        let gap = 8.0 * s;
        let count = self.zn + 1;
        let total = count as f32 * size + (count - 1) as f32 * gap;
        let x0 = (self.w - total) * 0.5;
        (x0 + k as f32 * (size + gap), self.h - self.taskbar_h() + 4.0 * s, size)
    }

    pub fn input(&mut self, kind: u32, x: f32, y: f32) {
        let s = self.s;
        match kind {
            input::DOWN => {
                if y >= self.h - self.taskbar_h() {
                    for k in 0..=self.zn {
                        let (bx, by, b) = self.taskbar_slot(k);
                        if x >= bx && x < bx + b && y >= by && y < by + b {
                            if k == 0 {
                                self.start_open = !self.start_open;
                            } else {
                                let mut order = [0u8; MAX_WINDOWS];
                                order[..self.zn].copy_from_slice(&self.z[..self.zn]);
                                order[..self.zn].sort_unstable();
                                self.raise(order[k - 1] as usize);
                            }
                            self.dirty = true;
                        }
                    }
                    return;
                }
                if self.start_open {
                    let (mx, my, mw, mh) = self.start_rect();
                    if x >= mx && x < mx + mw && y >= my && y < my + mh {
                        let accent = PALETTE[(self.rand() * 8.0) as usize % 8];
                        let (wx, wy) = (self.rand() * (self.w - 800.0 * s), self.rand() * (self.h - 700.0 * s));
                        self.window_create(wx, wy, 720.0 * s, 460.0 * s, accent);
                    }
                    self.start_open = false;
                    self.dirty = true;
                    return;
                }
                if let Some(i) = self.hit_window(x, y) {
                    self.raise(i);
                    let w = self.wins[i];
                    if y < w.y + 32.0 * s {
                        if x >= w.x + w.w - 46.0 * s {
                            self.window_close(self.handle_of(i));
                        } else {
                            self.drag = self.handle_of(i);
                            self.drag_dx = x - w.x;
                            self.drag_dy = y - w.y;
                        }
                    }
                    self.dirty = true;
                }
            }
            input::MOVE => {
                if let Some(i) = self.resolve(self.drag) {
                    self.wins[i].x = x - self.drag_dx;
                    self.wins[i].y = (y - self.drag_dy).max(0.0);
                    self.dirty = true;
                }
            }
            input::UP => self.drag = 0,
            _ => {}
        }
    }

    fn start_rect(&self) -> (f32, f32, f32, f32) {
        let s = self.s;
        let (w, h) = (640.0 * s, 720.0 * s);
        ((self.w - w) * 0.5, self.h - self.taskbar_h() - h - 12.0 * s, w, h)
    }

    fn push(&mut self, i: Instance) {
        if self.n < MAX_INSTANCES {
            self.inst[self.n] = i;
            self.n += 1;
        }
    }

    fn rect(&mut self, x: f32, y: f32, w: f32, h: f32, color: u32, radius: f32) {
        self.push(Instance { x, y, w, h, color, radius, shadow: 0.0, flags: 0 });
    }

    /// Avance la simulation. Renvoie le nombre d'instances à dessiner ; 0 = rien n'a changé
    /// (l'hôte ne présente pas de frame, docs/plan/02 P7).
    pub fn tick(&mut self, now_ms: f64) -> u32 {
        self.stats.ticks += 1;
        let dt = if self.started { ((now_ms - self.last_ms) as f32 * 0.001).clamp(0.0, 0.1) } else { 0.0 };
        self.started = true;
        self.last_ms = now_ms;
        let animating = self.pn > 0 && dt > 0.0;
        if !animating && !self.dirty {
            self.stats.idle_ticks += 1;
            return 0;
        }
        self.step_particles(dt);
        self.build();
        self.dirty = false;
        self.stats.instances = self.n as u32;
        self.stats.windows = self.zn as u32;
        self.stats.particles = self.pn as u32;
        self.n as u32
    }

    fn step_particles(&mut self, dt: f32) {
        let (w, top) = (self.w, self.h - self.taskbar_h());
        for p in &mut self.parts[..self.pn] {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if p.x < 0.0 || p.x + p.size > w {
                p.vx = -p.vx;
                p.x = p.x.clamp(0.0, w - p.size);
            }
            if p.y < 0.0 || p.y + p.size > top {
                p.vy = -p.vy;
                p.y = p.y.clamp(0.0, top - p.size);
            }
        }
    }

    fn build(&mut self) {
        let s = self.s;
        self.n = 0;
        self.push(Instance { x: 0.0, y: 0.0, w: self.w, h: self.h, color: WALL_TOP, radius: 0.0, shadow: 0.0, flags: 1 });
        for i in 0..self.pn {
            let p = self.parts[i];
            self.rect(p.x, p.y, p.size, p.size, p.color, p.size * 0.3);
        }
        for k in 0..self.zn {
            let w = self.wins[self.z[k] as usize];
            let r = 8.0 * s;
            self.push(Instance { x: w.x, y: w.y + 6.0 * s, w: w.w, h: w.h, color: 0x70_00_00_00, radius: r, shadow: 24.0 * s, flags: 0 });
            self.rect(w.x, w.y, w.w, w.h, WIN_BODY, r);
            self.rect(w.x, w.y, w.w, 32.0 * s, WIN_TITLE, r);
            self.rect(w.x + 12.0 * s, w.y + 10.0 * s, 12.0 * s, 12.0 * s, w.accent, 3.0 * s);
            self.rect(w.x + w.w - 46.0 * s, w.y, 46.0 * s, 32.0 * s, CLOSE, r);
            for l in 0..6 {
                let ly = w.y + (56.0 + l as f32 * 28.0) * s;
                if ly + 12.0 * s > w.y + w.h {
                    break;
                }
                let lw = (w.w - 48.0 * s) * (0.45 + 0.09 * (l % 5) as f32);
                self.rect(w.x + 24.0 * s, ly, lw, 12.0 * s, LINE, 6.0 * s);
            }
        }
        let tb = self.taskbar_h();
        self.rect(0.0, self.h - tb, self.w, tb, TASKBAR, 0.0);
        for k in 0..=self.zn {
            let (bx, by, b) = self.taskbar_slot(k);
            let c = if k == 0 { 0xFF_EF_A4_00 } else { 0xFF_50_50_50 };
            self.rect(bx, by, b, b, c, 6.0 * s);
        }
        if self.start_open {
            let (mx, my, mw, mh) = self.start_rect();
            self.push(Instance { x: mx, y: my, w: mw, h: mh, color: 0x80_00_00_00, radius: 12.0 * s, shadow: 32.0 * s, flags: 0 });
            self.rect(mx, my, mw, mh, 0xF2_2C_2C_2C, 12.0 * s);
            for t in 0..18 {
                let (cx, cy) = ((t % 6) as f32, (t / 6) as f32);
                self.rect(mx + (32.0 + cx * 96.0) * s, my + (96.0 + cy * 112.0) * s, 64.0 * s, 64.0 * s, PALETTE[t % 8], 10.0 * s);
            }
        }
    }

    #[must_use]
    pub fn instances(&self) -> &[Instance] {
        &self.inst[..self.n]
    }

    #[must_use]
    pub fn stats(&self) -> &Stats {
        &self.stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kernel() -> Box<Kernel> {
        let mut k = Box::new(Kernel::ZERO);
        k.boot(3840.0, 2160.0, 42, 10_000);
        k
    }

    #[test]
    fn boot_builds_scene_within_capacity() {
        let mut k = kernel();
        let n = k.tick(0.0);
        assert!(n as usize > 10_000 && n as usize <= MAX_INSTANCES, "n = {n}");
        assert_eq!(k.instances()[0].flags, 1);
    }

    #[test]
    fn idle_returns_zero() {
        let mut k = Box::new(Kernel::ZERO);
        k.boot(1920.0, 1080.0, 1, 0);
        assert!(k.tick(0.0) > 0);
        assert_eq!(k.tick(16.0), 0);
        assert_eq!(k.stats().idle_ticks, 1);
    }

    #[test]
    fn stale_handle_is_rejected() {
        let mut k = kernel();
        let h = k.window_create(0.0, 0.0, 100.0, 100.0, 0);
        assert!(k.window_close(h));
        assert!(!k.window_close(h));
        let h2 = k.window_create(0.0, 0.0, 100.0, 100.0, 0);
        assert_ne!(h, h2);
    }

    #[test]
    fn drag_moves_window() {
        let mut k = Box::new(Kernel::ZERO);
        k.boot(1920.0, 1080.0, 7, 0);
        k.tick(0.0);
        let top = k.z[k.zn - 1] as usize;
        let (x, y) = (k.wins[top].x + 100.0, k.wins[top].y + 10.0);
        k.input(input::DOWN, x, y);
        k.input(input::MOVE, x + 50.0, y + 20.0);
        k.input(input::UP, x + 50.0, y + 20.0);
        assert!((k.wins[top].x - (x + 50.0 - 100.0)).abs() < 1e-3);
    }

    #[test]
    fn particles_stay_on_desktop() {
        let mut k = kernel();
        for f in 0..600 {
            k.tick(f64::from(f) * 8.33);
        }
        let top = k.h - k.taskbar_h();
        assert!(k.parts[..k.pn].iter().all(|p| p.x >= 0.0 && p.y >= 0.0 && p.x + p.size <= k.w + 0.01 && p.y + p.size <= top + 0.01));
    }
}

/// Génère l'ABI C du noyau (docs/plan/03 §3) dans un crate hôte `no_std` (wasm32 ou staticlib native).
/// Contrat : un seul fil d'exécution appelle ces fonctions (navigateur, ou thread du shell .NET).
#[macro_export]
macro_rules! export_c_abi {
    () => {
        struct NtGlobal(core::cell::UnsafeCell<$crate::Kernel>);
        // SAFETY: contrat mono-thread documenté ci-dessus ; aucun export n'est réentrant.
        unsafe impl Sync for NtGlobal {}
        static NT_KERNEL: NtGlobal = NtGlobal(core::cell::UnsafeCell::new($crate::Kernel::ZERO));

        fn nt_k() -> &'static mut $crate::Kernel {
            // SAFETY: contrat mono-thread, pas de référence vivante entre deux appels.
            unsafe { &mut *NT_KERNEL.0.get() }
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn nt_boot(width: f32, height: f32, seed: u32, particles: u32) {
            nt_k().boot(width, height, seed, particles);
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn nt_tick(now_ms: f64) -> u32 {
            nt_k().tick(now_ms)
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn nt_instances() -> *const $crate::Instance {
            nt_k().instances().as_ptr()
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn nt_input(kind: u32, x: f32, y: f32) {
            nt_k().input(kind, x, y);
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn nt_window_create(x: f32, y: f32, w: f32, h: f32, accent: u32) -> $crate::Handle {
            nt_k().window_create(x, y, w, h, accent)
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn nt_window_close(h: $crate::Handle) -> u32 {
            u32::from(nt_k().window_close(h))
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn nt_stats() -> *const $crate::Stats {
            nt_k().stats()
        }
    };
}
