#!/usr/bin/env bash
set -euo pipefail

source_dir=$(realpath "${1:?Usage: build-n31.sh LINUX_TREE OUTPUT_DIR}")
output_dir=$(realpath -m "${2:?Usage: build-n31.sh LINUX_TREE OUTPUT_DIR}")
jobs=${NANO7_KERNEL_JOBS:-$(nproc)}
cross=${CROSS_COMPILE:-arm-linux-gnueabihf-}

mkdir -p "$output_dir"
make -C "$source_dir" O="$output_dir" ARCH=arm CROSS_COMPILE="$cross" apple_n31_defconfig
make -C "$source_dir" O="$output_dir" ARCH=arm CROSS_COMPILE="$cross" -j"$jobs" \
    zImage samsung/s5l8740-n31.dtb
