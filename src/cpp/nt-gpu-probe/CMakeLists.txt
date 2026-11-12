cmake_minimum_required(VERSION 3.30)
# Sonde des capacités Direct3D 12 (spike S0.2). C++23 standard (pas de `import std` : expérimental dans CMake 4.4).
# Dépendances récupérées par FetchContent, épinglées par commit sur les forks aphrody-labs.
project(nt_gpu_probe LANGUAGES CXX)

if(NOT WIN32)
  message(STATUS "nt-gpu-probe : Direct3D 12 n'existe que sous Windows, cible ignorée")
  return()
endif()

include(FetchContent)
# DirectX-Headers v1.620.2 (= Agility SDK 1.620.2 utilisé par l'hôte natif)
FetchContent_Declare(directx_headers
  GIT_REPOSITORY https://github.com/aphrody-labs/DirectX-Headers.git
  GIT_TAG 61c7718954ec73dbdd43c723240fe1a0452a3724
  GIT_SHALLOW FALSE)
FetchContent_Declare(wil
  GIT_REPOSITORY https://github.com/aphrody-labs/wil.git
  GIT_TAG abb1bd3509b6e5db53ba29738a4180d857adfd40)
set(WIL_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(WIL_BUILD_PACKAGING OFF CACHE BOOL "" FORCE)
set(DXHEADERS_BUILD_TEST OFF CACHE BOOL "" FORCE)
set(DXHEADERS_BUILD_GOOGLE_TEST OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(directx_headers wil)

add_executable(nt-gpu-probe probe.cpp)
target_compile_features(nt-gpu-probe PRIVATE cxx_std_23)
target_link_libraries(nt-gpu-probe PRIVATE Microsoft::DirectX-Headers WIL::WIL d3d12 dxgi)
if(MSVC)
  target_compile_options(nt-gpu-probe PRIVATE /W4 /WX /permissive- /guard:cf /utf-8)
  target_link_options(nt-gpu-probe PRIVATE /CETCOMPAT /DYNAMICBASE /GUARD:CF)
endif()

# Agility SDK : D3D12Core.dll dans <exe>\D3D12\ (export D3D12SDKPath). Paquet NuGet récupéré par `just tools`.
if(CMAKE_SYSTEM_PROCESSOR MATCHES "ARM64|arm64|aarch64")
  set(NT_AGILITY_ARCH arm64)
else()
  set(NT_AGILITY_ARCH x64)
endif()
set(NT_AGILITY_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../tools/dxc/microsoft.direct3d.d3d12/build/native/bin/${NT_AGILITY_ARCH}")
add_custom_command(TARGET nt-gpu-probe POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:nt-gpu-probe>/D3D12"
  COMMAND ${CMAKE_COMMAND} -E copy_if_different "${NT_AGILITY_DIR}/D3D12Core.dll" "$<TARGET_FILE_DIR:nt-gpu-probe>/D3D12/"
  VERBATIM)
