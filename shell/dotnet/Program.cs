// nt shell — .NET 11 NativeAOT ; le noyau Rust (nt_ffi.lib, no_std) est lié statiquement (DirectPInvoke).
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

const float W = 3840, H = 2160;
const int Frames = 1200;

Nt.Boot(W, H, 0x5eed, 10_000);
var first = Nt.Tick(0);
uint[] handles = new uint[8];
for (var i = 0; i < handles.Length; i++)
    handles[i] = Nt.WindowCreate(100 + i * 60, 100 + i * 40, 900, 600, 0xFF_D4_78_00);
var closedTwice = 0u;
for (var i = 0; i < 4; i++)
{
    _ = Nt.WindowClose(handles[i]);
    closedTwice += Nt.WindowClose(handles[i]); // handle périmé : doit être refusé (0)
}

var ticks = new double[Frames];
uint n = 0;
for (var f = 0; f < Frames; f++)
{
    var t0 = Stopwatch.GetTimestamp();
    n = Nt.Tick((f + 1) * 1000.0 / 120.0);
    ticks[f] = Stopwatch.GetElapsedTime(t0).TotalMilliseconds;
}
Array.Sort(ticks);
var stats = Nt.ReadStats();
Console.WriteLine(
    $$"""{"runtime":"{{RuntimeInformation.FrameworkDescription}}","aot":{{(!RuntimeFeature.IsDynamicCodeSupported).ToString().ToLowerInvariant()}},"firstTick":{{first}},"instances":{{n}},"windows":{{stats.Windows}},"staleHandleAccepted":{{closedTwice}},"tickMsP50":{{ticks[Frames / 2]:F4}},"tickMsP99":{{ticks[(int)(Frames * 0.99)]:F4}},"ticks":{{stats.Ticks}}}""");
return closedTwice == 0 && stats.Windows == 7 ? 0 : 1;

[StructLayout(LayoutKind.Sequential)]
internal readonly record struct NtStats(uint Instances, uint Windows, uint Particles, uint Ticks, uint IdleTicks);

internal static unsafe partial class Nt
{
    private const string Lib = "nt_ffi";

    [LibraryImport(Lib, EntryPoint = "nt_boot")]
    internal static partial void Boot(float width, float height, uint seed, uint particles);

    [LibraryImport(Lib, EntryPoint = "nt_tick")]
    internal static partial uint Tick(double nowMs);

    [LibraryImport(Lib, EntryPoint = "nt_window_create")]
    internal static partial uint WindowCreate(float x, float y, float w, float h, uint accent);

    [LibraryImport(Lib, EntryPoint = "nt_window_close")]
    internal static partial uint WindowClose(uint handle);

    [LibraryImport(Lib, EntryPoint = "nt_stats")]
    private static partial NtStats* Stats();

    internal static NtStats ReadStats() => *Stats();
}
