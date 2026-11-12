// Types d'interop blittables (aucun bool/char : disposition séquentielle identique côté natif et managé).
// Valeurs des énumérations = celles de System.IO.DriveType et System.Runtime.InteropServices.Architecture,
// lues dans les métadonnées de Microsoft.NETCore.App 11.0.0 par sdk/tools/dotnet-ffi/ecma335.ts (2026-11-12).
using Nt.Interop.Ffi;

namespace Nt.Interop;

public enum NtPlatform
{
    Unknown = 0,
    Windows = 1,
    Linux = 2,
    MacOS = 3,
    FreeBsd = 4,
}

public enum NtArchitecture
{
    X86 = 0,
    X64 = 1,
    Arm = 2,
    Arm64 = 3,
    Wasm = 4,
    S390x = 5,
    LoongArch64 = 6,
    Armv6 = 7,
    Ppc64le = 8,
    RiscV64 = 9,
}

public enum NtDriveKind
{
    Unknown = 0,
    NoRootDirectory = 1,
    Removable = 2,
    Fixed = 3,
    Network = 4,
    CDRom = 5,
    Ram = 6,
}

/// <summary>Faits du système hôte, remplis par <c>nt_system_info</c> (88 octets, alignement 8).</summary>
[System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
public unsafe struct NtSystemInfo
{
    public int Major;
    public int Minor;
    public int Build;
    /// <summary>Windows : UBR du registre ; sinon Environment.OSVersion.Version.Revision.</summary>
    public int Revision;
    public NtPlatform Platform;
    public NtArchitecture Architecture;
    public int ProcessorCount;
    public int PageSize;
    /// <summary>1 si le code tourne en NativeAOT (pas de code dynamique), 0 sous CoreCLR.</summary>
    public byte IsAot;
    public byte Is64Bit;
    public long TotalMemory;
    public long TickCount;
    /// <summary>Windows : DisplayVersion du registre (ex. 25H2).</summary>
    [Utf16]
    public fixed ushort DisplayVersion[16];
}
