//! ABI C native du noyau en staticlib `no_std` : liée statiquement par `NativeAOT` (.NET 11, `DirectPInvoke`)
//! et par C++. Aucune dépendance à la std Rust ni au runtime C hors `abort`.
#![no_std]

nt_kernel::export_c_abi!();

unsafe extern "C" {
    safe fn abort() -> !;
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    abort()
}
