//! Compile les shaders HLSL en DXIL avec DXC 1.9.2609 (`just tools` le récupère dans `tools/dxc/<os-hôte>/`).
//! N'écrit que dans `OUT_DIR` ; l'Agility SDK est copié à côté de l'exe par `just native` (`tools/stage-native.ts`).
use std::{env, path::PathBuf, process::Command};

fn main() {
    println!("cargo:rerun-if-changed=shaders/nt.hlsl");
    println!("cargo:rerun-if-env-changed=NT_DXC");
    // Hôte D3D12 : seules les cibles Windows ont quelque chose à compiler.
    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let root = manifest.join("../..");
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    // DXC de l'hôte de compilation (compilation croisée possible depuis Linux).
    let host_dxc = if cfg!(windows) { root.join("sdk/tools/dxc/windows/bin/x64/dxc.exe") } else { root.join("sdk/tools/dxc/linux/bin/dxc") };
    let dxc = env::var_os("NT_DXC").map_or(host_dxc, PathBuf::from);
    let src = manifest.join("shaders/nt.hlsl");
    for (entry, profile) in [("vs", "vs_6_6"), ("ps", "ps_6_6")] {
        let dst = out.join(format!("{entry}.dxil"));
        let status = Command::new(&dxc)
            .args(["-HV", "202x", "-O3", "-Qstrip_debug", "-Qstrip_reflect", "-WX", "-E", entry, "-T", profile, "-Fo"])
            .arg(&dst)
            .arg(&src)
            .status()
            .unwrap_or_else(|e| panic!("DXC introuvable ({}) : {e} — lancer `just tools` ou définir NT_DXC", dxc.display()));
        assert!(status.success(), "DXC a échoué pour {entry}");
    }
    // Agility SDK : l'exe exporte D3D12SDKVersion / D3D12SDKPath (Learn « D3D12SDKVersion symbol »).
    if env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        println!("cargo:rustc-link-arg-bins=/EXPORT:D3D12SDKVersion,DATA");
        println!("cargo:rustc-link-arg-bins=/EXPORT:D3D12SDKPath,DATA");
    } else {
        println!("cargo:rustc-link-arg-bins=-Wl,--export=D3D12SDKVersion");
        println!("cargo:rustc-link-arg-bins=-Wl,--export=D3D12SDKPath");
    }
}
