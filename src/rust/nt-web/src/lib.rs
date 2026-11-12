//! ABI wasm32 du noyau (exports C bruts, sans wasm-bindgen) — docs/plan/03-design-systeme.md §3.
#![no_std]
#![cfg(target_arch = "wasm32")]

nt_kernel::export_c_abi!();

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}
