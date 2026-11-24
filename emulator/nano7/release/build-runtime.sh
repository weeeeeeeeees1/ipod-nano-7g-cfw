#!/usr/bin/env bash
set -euo pipefail

qemu=$(realpath "${1:?usage: build-runtime.sh QEMU N31_BUILD INITRAMFS OUTPUT}")
n31=$(realpath "${2:?missing N31 build directory}")
initramfs=$(realpath "${3:?missing N31 initramfs}")
output=$(realpath -m "${4:?missing output directory}")
source_dir=$(cd "$(dirname "$0")/.." && pwd)
kernel_release=$(uname -r)
root=$(mktemp -d)
trap 'rm -rf -- "$root"' EXIT

mkdir -p "$output" "$root"/{bin,dev,proc,sys,tmp,run,usr/bin,usr/lib,usr/share/qemu,nano7/modules}
install -m755 "$source_dir/release/runtime-init.sh" "$root/init"
install "$(command -v busybox)" "$root/bin/busybox"
ln -s busybox "$root/bin/sh"
strip -o "$root/usr/bin/qemu-system-arm" "$qemu"
cp -aL "$(dirname "$qemu")/qemu-bundle/usr/local/share/qemu/keymaps" "$root/usr/share/qemu/"
install /usr/bin/python3.11 "$root/usr/bin/python3.11"
ln -s python3.11 "$root/usr/bin/python3"
install "$(command -v fdtput)" "$root/usr/bin/fdtput"
cp -a /usr/lib/python3.11 "$root/usr/lib/"
find "$root/usr/lib/python3.11" -type f -name '*.pyc' -delete

{
    ldd "$qemu" /usr/bin/python3.11 "$(command -v fdtput)"
    find /usr/lib/python3.11/lib-dynload -type f -name '*.so' -exec ldd {} +
} | awk '$2 == "=>" && $3 ~ /^\// { print $3 }
          $1 ~ /^\// && $2 ~ /^\(/ { print $1 }' | sort -u |
    while IFS= read -r library; do
        install -D -m755 "$library" "$root$library"
    done

{
    /sbin/modprobe --show-depends virtio_pci
    /sbin/modprobe --show-depends virtio_net
} | awk '$1 == "insmod" && !seen[$2]++ { print $2 }' |
    while IFS= read -r module; do
        destination="/nano7/modules/${module##*/}"
        install -m644 "$module" "$root$destination"
        printf '%s\n' "$destination"
    done > "$root/nano7/modules/list"

for demo in display-controls audio-storage; do
    arm-linux-gnueabihf-gcc -march=armv7-a -mfpu=vfpv3-d16 -marm \
        -O2 -mno-unaligned-access -Wall -Wextra -ffreestanding -fno-pie \
        -nostdlib -static -Wl,-Ttext=0x08000000,--build-id=none,-e,_start \
        -o "$root/$demo.elf" "$source_dir/$demo.c"
    arm-linux-gnueabihf-objcopy -O binary "$root/$demo.elf" "$root/nano7/$demo.bin"
    rm -- "$root/$demo.elf"
done
cp "$source_dir"/{boot-linux.py,nano7_qmp.py,verify-display-controls.py,verify-audio-storage.py} "$root/nano7/"
cp "$n31/arch/arm/boot/zImage" "$root/nano7/zImage"
cp "$n31/arch/arm/boot/dts/samsung/s5l8740-n31.dtb" "$root/nano7/n31.dtb"
cp "$initramfs" "$root/nano7/n31-initramfs.cpio.gz"
cp "/boot/vmlinuz-$kernel_release" "$output/vmlinuz"
(
    cd "$root"
    find . -print0 | cpio --quiet --null -o -H newc --owner=0:0 | gzip -1n
) > "$output/runtime.cpio.gz"
{
    printf 'Nano 7G Windows-hosted emulator runtime\n\n'
    "$qemu" --version
    printf '\nDebian runtime kernel: %s\n' "$kernel_release"
    dpkg-query -W busybox-static libc6 python3.11 device-tree-compiler
    sha256sum "$qemu" "$n31/arch/arm/boot/zImage" \
        "$n31/arch/arm/boot/dts/samsung/s5l8740-n31.dtb" "$initramfs"
} > "$output/README-build.txt"
sha256sum "$output/vmlinuz" "$output/runtime.cpio.gz"
