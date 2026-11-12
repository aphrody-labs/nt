// nt-gpu-probe — capacités D3D12 réelles du GPU. C++23 `import std;` (CMake 4.5, MSVC), WIL, DirectX-Headers (vcpkg).
// Aucun en-tête de la bibliothèque standard C++ à côté de `import std` (Learn « Standard library named module considerations ») :
// WIL sans exceptions (WIL_SUPPRESS_EXCEPTIONS => WIL_USE_STL 0, wil/common.h) n'inclut ni <tuple>, ni <iterator>, ni <new>.
#define NOMINMAX
#define WIL_SUPPRESS_EXCEPTIONS
#include <windows.h>
#include <directx/d3d12.h> // DirectX-Headers 1.620.2 (port vcpkg aphrody-labs)
#include <dxgi1_6.h>
#include <wil/com.h>
import std;

// Agility SDK 1.620 (Learn « D3D12SDKVersion symbol ») ; D3D12Core.dll copié dans .\D3D12\ par CMake (POST_BUILD).
extern "C" { __declspec(dllexport) extern const UINT D3D12SDKVersion = 620; }
extern "C" { __declspec(dllexport) extern const char* D3D12SDKPath = ".\\D3D12\\"; }

template <class T>
static bool query(ID3D12Device* d, D3D12_FEATURE f, T& data) {
    return SUCCEEDED(d->CheckFeatureSupport(f, &data, sizeof(T)));
}

int main() {
    wil::com_ptr_nothrow<IDXGIFactory6> factory;
    if (FAILED(CreateDXGIFactory2(0, IID_PPV_ARGS(&factory)))) return 1;
    wil::com_ptr_nothrow<IDXGIAdapter1> adapter;
    if (FAILED(factory->EnumAdapterByGpuPreference(0, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, IID_PPV_ARGS(&adapter)))) return 2;
    DXGI_ADAPTER_DESC1 ad{};
    adapter->GetDesc1(&ad);
    wil::com_ptr_nothrow<ID3D12Device> device;
    if (FAILED(D3D12CreateDevice(adapter.get(), D3D_FEATURE_LEVEL_12_0, IID_PPV_ARGS(&device)))) return 3;

    D3D12_FEATURE_DATA_SHADER_MODEL sm{D3D_HIGHEST_SHADER_MODEL};
    while (!query(device.get(), D3D12_FEATURE_SHADER_MODEL, sm) && sm.HighestShaderModel > D3D_SHADER_MODEL_6_0)
        sm.HighestShaderModel = static_cast<D3D_SHADER_MODEL>(sm.HighestShaderModel - 1);
    D3D12_FEATURE_DATA_D3D12_OPTIONS o0{};
    D3D12_FEATURE_DATA_D3D12_OPTIONS5 o5{};
    D3D12_FEATURE_DATA_D3D12_OPTIONS6 o6{};
    D3D12_FEATURE_DATA_D3D12_OPTIONS7 o7{};
    D3D12_FEATURE_DATA_D3D12_OPTIONS12 o12{};
    D3D12_FEATURE_DATA_D3D12_OPTIONS16 o16{};
    D3D12_FEATURE_DATA_D3D12_OPTIONS21 o21{};
    query(device.get(), D3D12_FEATURE_D3D12_OPTIONS, o0);
    query(device.get(), D3D12_FEATURE_D3D12_OPTIONS5, o5);
    query(device.get(), D3D12_FEATURE_D3D12_OPTIONS6, o6);
    query(device.get(), D3D12_FEATURE_D3D12_OPTIONS7, o7);
    query(device.get(), D3D12_FEATURE_D3D12_OPTIONS12, o12);
    const bool has16 = query(device.get(), D3D12_FEATURE_D3D12_OPTIONS16, o16);
    const bool has21 = query(device.get(), D3D12_FEATURE_D3D12_OPTIONS21, o21);

    wil::com_ptr_nothrow<IDXGIFactory5> f5;
    BOOL tearing = FALSE;
    if (SUCCEEDED(factory->QueryInterface(IID_PPV_ARGS(&f5))))
        f5->CheckFeatureSupport(DXGI_FEATURE_PRESENT_ALLOW_TEARING, &tearing, sizeof(tearing));

    const std::wstring_view wname{ad.Description};
    std::string name;
    for (wchar_t c : wname) name.push_back(c < 128 ? static_cast<char>(c) : '?');
    std::println(R"({{"adapter":"{}","vramMiB":{},"highestShaderModel":"{}.{}","resourceBindingTier":{},"raytracingTier":"0x{:x}",)"
                 R"("vrsTier":{},"meshShaderTier":"0x{:x}","enhancedBarriers":{},"gpuUploadHeap":{},"workGraphsTier":"0x{:x}","tearing":{},"agilitySdkRequested":{}}})",
                 name, ad.DedicatedVideoMemory >> 20, sm.HighestShaderModel >> 4, sm.HighestShaderModel & 0xF,
                 static_cast<int>(o0.ResourceBindingTier), static_cast<int>(o5.RaytracingTier), static_cast<int>(o6.VariableShadingRateTier),
                 static_cast<int>(o7.MeshShaderTier), o12.EnhancedBarriersSupported ? "true" : "false",
                 has16 && o16.GPUUploadHeapSupported ? "true" : "false", has21 ? static_cast<int>(o21.WorkGraphsTier) : -1,
                 tearing ? "true" : "false", D3D12SDKVersion);
    return 0;
}
