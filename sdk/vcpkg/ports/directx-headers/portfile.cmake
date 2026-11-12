# Port aphrody-labs : portfile de microsoft/vcpkg@177e8175 (ports/directx-headers), source = fork épinglé par commit.
vcpkg_from_github(
    OUT_SOURCE_PATH SOURCE_PATH
    REPO aphrody-labs/DirectX-Headers
    REF 61c7718954ec73dbdd43c723240fe1a0452a3724 # v1.620.2
    SHA512 a44907889336e44f529a09aa68b9ad3b2d79fd52bc1840bd99cc33a5fc32e256ddda96e41eebd8780d1928b44a049ee4c3bada2d5d29e0bfb9ba2d6a14500780
    HEAD_REF main
)

vcpkg_cmake_configure(
    SOURCE_PATH "${SOURCE_PATH}"
    OPTIONS -DDXHEADERS_INSTALL=ON -DDXHEADERS_BUILD_TEST=OFF -DDXHEADERS_BUILD_GOOGLE_TEST=OFF
)

vcpkg_cmake_install()
vcpkg_fixup_pkgconfig()
vcpkg_cmake_config_fixup(CONFIG_PATH share/directx-headers/cmake)

file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/debug/include")

file(INSTALL "${CMAKE_CURRENT_LIST_DIR}/usage" DESTINATION "${CURRENT_PACKAGES_DIR}/share/${PORT}")
vcpkg_install_copyright(FILE_LIST "${SOURCE_PATH}/LICENSE")
