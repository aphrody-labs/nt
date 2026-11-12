cmake_minimum_required(VERSION 4.5)
# Sonde des capacités Direct3D 12. C++23 avec `import std;` : stable depuis CMake 4.5 pour toute cible
# C++20+ scannée (Help/release/4.5.rst), générateurs Ninja seulement, MSVC 14.36+ (cmake-cxxmodules(7)).
# Dépendances : vcpkg en mode manifeste (vcpkg.json, vcpkg-configuration.json), ports aphrody-labs en overlay.
project(nt_gpu_probe LANGUAGES CXX)

if(NOT WIN32)
  message(STATUS "nt-gpu-probe : Direct3D 12 n'existe que sous Windows, cible ignorée")
  return()
endif()

find_package(directx-headers CONFIG REQUIRED) # 1.620.2 = Agility SDK 1.620.2
find_package(wil CONFIG REQUIRED)

add_executable(nt-gpu-probe probe.cpp)
target_compile_features(nt-gpu-probe PRIVATE cxx_std_23)
set_target_properties(nt-gpu-probe PROPERTIES CXX_SCAN_FOR_MODULES ON)
target_link_libraries(nt-gpu-probe PRIVATE Microsoft::DirectX-Headers WIL::WIL d3d12 dxgi)
if(MSVC)
  # Options de cible : CMake les reporte sur la cible synthétique qui compile le BMI de `std` (cmake-cxxmodules(7)).
  target_compile_options(nt-gpu-probe PRIVATE /W4 /WX /permissive- /guard:cf /utf-8)
  target_link_options(nt-gpu-probe PRIVATE /CETCOMPAT /DYNAMICBASE /GUARD:CF)
endif()

# Agility SDK : D3D12Core.dll dans <exe>\D3D12\ (export D3D12SDKPath). Paquet NuGet récupéré par `just tools`.
string(TOLOWER "${CMAKE_CXX_COMPILER_ARCHITECTURE_ID}" NT_AGILITY_ARCH) # x64 | arm64
set(NT_AGILITY_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../dxc/microsoft.direct3d.d3d12/build/native/bin/${NT_AGILITY_ARCH}")
add_custom_command(TARGET nt-gpu-probe POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:nt-gpu-probe>/D3D12"
  COMMAND ${CMAKE_COMMAND} -E copy_if_different "${NT_AGILITY_DIR}/D3D12Core.dll" "$<TARGET_FILE_DIR:nt-gpu-probe>/D3D12/"
  VERBATIM)
