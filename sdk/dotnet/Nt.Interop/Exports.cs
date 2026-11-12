// Exports C de Nt.Interop (.NET 11) pour bun:ffi, sans node-api-dotnet.
// DisableRuntimeMarshalling : aucune conversion implicite (Learn « Disabled runtime marshalling ») ; .NET 11 NativeAOT termine le
// processus sur une signature UnmanagedCallersOnly non blittable (Learn « Native code interop with Native AOT »).
// Aucune exception ne traverse la frontière : codes négatifs (-1 argument invalide, -2 exception).
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text;
using Microsoft.Win32;
using Nt.Interop.Ffi;

[assembly: DisableRuntimeMarshalling]

namespace Nt.Interop;

public static unsafe class Exports
{
    /// <summary>Appel vide : coût fixe d'une transition bun -> .NET.</summary>
    [UnmanagedCallersOnly(EntryPoint = "nt_noop")]
    public static void Noop()
    {
    }

    [UnmanagedCallersOnly(EntryPoint = "nt_add")]
    public static int Add(int a, int b) => a + b;

    /// <summary>Environment.TickCount64 (retour 64 bits : BigInt côté bun).</summary>
    [UnmanagedCallersOnly(EntryPoint = "nt_tick_count")]
    public static long TickCount() => Environment.TickCount64;

    [UnmanagedCallersOnly(EntryPoint = "nt_system_info")]
    public static int SystemInfo(NtSystemInfo* result)
    {
        if (result == null)
        {
            return -1;
        }
        try
        {
            *result = default;
            Version v = Environment.OSVersion.Version;
            result->Major = v.Major;
            result->Minor = v.Minor;
            result->Build = Math.Max(v.Build, 0);
            result->Revision = Math.Max(v.Revision, 0);
            result->Platform =
                OperatingSystem.IsWindows() ? NtPlatform.Windows
                : OperatingSystem.IsLinux() ? NtPlatform.Linux
                : OperatingSystem.IsMacOS() ? NtPlatform.MacOS
                : OperatingSystem.IsFreeBSD() ? NtPlatform.FreeBsd
                : NtPlatform.Unknown;
            result->Architecture = (NtArchitecture)(int)RuntimeInformation.ProcessArchitecture;
            result->ProcessorCount = Environment.ProcessorCount;
            result->PageSize = Environment.SystemPageSize;
            result->IsAot = RuntimeFeature.IsDynamicCodeSupported ? (byte)0 : (byte)1;
            result->Is64Bit = Environment.Is64BitProcess ? (byte)1 : (byte)0;
            result->TotalMemory = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
            result->TickCount = Environment.TickCount64;
            if (OperatingSystem.IsWindows())
            {
                ReadWindowsVersion(result);
            }
            return 0;
        }
        catch (Exception)
        {
            return -2;
        }
    }

    [SupportedOSPlatform("windows")]
    private static void ReadWindowsVersion(NtSystemInfo* result)
    {
        const string key = @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion";
        if (Registry.GetValue(key, "UBR", null) is int ubr)
        {
            result->Revision = ubr;
        }
        if (Registry.GetValue(key, "DisplayVersion", null) is string display)
        {
            CopyUtf16(display, (char*)result->DisplayVersion, 16);
        }
    }

    [UnmanagedCallersOnly(EntryPoint = "nt_machine_name")]
    public static int MachineName([Utf16Buffer] char* buffer, int capacity)
    {
        try
        {
            return CopyUtf16(Environment.MachineName, buffer, capacity);
        }
        catch (Exception)
        {
            return -2;
        }
    }

    [UnmanagedCallersOnly(EntryPoint = "nt_os_description")]
    public static int OsDescription([Utf16Buffer] char* buffer, int capacity) => CopyUtf16(RuntimeInformation.OSDescription, buffer, capacity);

    [UnmanagedCallersOnly(EntryPoint = "nt_framework")]
    public static int Framework([Utf8Buffer] byte* buffer, int capacity) => CopyUtf8(RuntimeInformation.FrameworkDescription, buffer, capacity);

    [UnmanagedCallersOnly(EntryPoint = "nt_runtime_id")]
    public static int RuntimeId([Utf8Buffer] byte* buffer, int capacity) => CopyUtf8(RuntimeInformation.RuntimeIdentifier, buffer, capacity);

    /// <summary>Longueur en octets d'une chaîne UTF-8 (bun:ffi cstring : transcodée par JavaScriptCore).</summary>
    [UnmanagedCallersOnly(EntryPoint = "nt_utf8_length")]
    public static int Utf8Length([Utf8] byte* text) => text == null ? -1 : MemoryMarshal.CreateReadOnlySpanFromNullTerminated(text).Length;

    /// <summary>Longueur en unités UTF-16 d'une chaîne UTF-16 (encodée côté bun : bun:ffi n'a pas de type wchar_t).</summary>
    [UnmanagedCallersOnly(EntryPoint = "nt_utf16_length")]
    public static int Utf16Length([Utf16] char* text) => text == null ? -1 : MemoryMarshal.CreateReadOnlySpanFromNullTerminated(text).Length;

    /// <summary>Aller-retour UTF-16 : copie en majuscules invariantes.</summary>
    [UnmanagedCallersOnly(EntryPoint = "nt_upper")]
    public static int Upper([Utf16] char* text, [Utf16Buffer] char* buffer, int capacity)
    {
        if (text == null)
        {
            return -1;
        }
        ReadOnlySpan<char> s = MemoryMarshal.CreateReadOnlySpanFromNullTerminated(text);
        if (buffer != null && s.Length < capacity)
        {
            _ = s.ToUpperInvariant(new Span<char>(buffer, capacity));
            buffer[s.Length] = '\0';
        }
        return s.Length;
    }

    /// <summary>Rappel par lecteur : visit(nom, longueur, type, taille totale) ; 0 arrête. Renvoie le nombre visité.</summary>
    [UnmanagedCallersOnly(EntryPoint = "nt_drives")]
    public static int Drives(delegate* unmanaged<char*, int, NtDriveKind, long, int> visit)
    {
        if (visit == null)
        {
            return -1;
        }
        try
        {
            int n = 0;
            foreach (DriveInfo d in DriveInfo.GetDrives())
            {
                long size = 0;
                try
                {
                    if (d.IsReady)
                    {
                        size = d.TotalSize;
                    }
                }
                catch (Exception)
                {
                    size = -1;
                }
                string name = d.Name;
                n++;
                fixed (char* p = name)
                {
                    if (visit(p, name.Length, (NtDriveKind)(int)d.DriveType, size) == 0)
                    {
                        break;
                    }
                }
            }
            return n;
        }
        catch (Exception)
        {
            return -2;
        }
    }

    /// <summary>Appelle callback(i) pour i dans [0, count) et somme les retours : coût d'un rappel .NET -> bun.</summary>
    [UnmanagedCallersOnly(EntryPoint = "nt_sum_callbacks")]
    public static long SumCallbacks(delegate* unmanaged<int, int> callback, int count)
    {
        if (callback == null)
        {
            return -1;
        }
        long sum = 0;
        for (int i = 0; i < count; i++)
        {
            sum += callback(i);
        }
        return sum;
    }

    /// <summary>Sans EntryPoint : joignable seulement par l'hôte CoreCLR (hostfxr). 1 sous CoreCLR (JIT), 0 en NativeAOT.</summary>
    [UnmanagedCallersOnly]
    public static int DynamicCode() => RuntimeFeature.IsDynamicCodeSupported ? 1 : 0;

    private static int CopyUtf16(ReadOnlySpan<char> value, char* buffer, int capacity)
    {
        if (buffer != null && value.Length < capacity)
        {
            value.CopyTo(new Span<char>(buffer, capacity));
            buffer[value.Length] = '\0';
        }
        return value.Length;
    }

    private static int CopyUtf8(string value, byte* buffer, int capacity)
    {
        int n = Encoding.UTF8.GetByteCount(value);
        if (buffer != null && n < capacity)
        {
            _ = Encoding.UTF8.GetBytes(value, new Span<byte>(buffer, capacity));
            buffer[n] = 0;
        }
        return n;
    }
}
