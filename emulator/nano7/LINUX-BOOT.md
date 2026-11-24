# Phase 3 · N31 Linux boot

This test uses the [Phase 2 NanoEmu build](BOARD-SMOKE.md) with UART3 and the
opt-in N31 timer model. It loads the open-source N31 kernel and device tree
directly into emulated RAM. No iPod, Apple firmware, USB passthrough or
persistent guest storage is needed.

## Build the N31 kernel

Run from this directory on the Debian build host. Use the
[freemyipod Linux tree](https://github.com/freemyipod/linux/tree/043ef51472d3471d525fbb55248c84039946d5b7)
at commit `043ef51472d3471d525fbb55248c84039946d5b7`.

```sh
sudo apt-get install --no-install-recommends \
  build-essential gcc-arm-linux-gnueabihf bc bison flex libssl-dev libelf-dev \
  device-tree-compiler python3

linux_tree=/path/to/freemyipod-linux
out_dir=../../out/n31-linux
bash build-n31.sh "$linux_tree" "$out_dir"
```

The script uses `apple_n31_defconfig`. It accepts `NANO7_KERNEL_JOBS` and
`CROSS_COMPILE` overrides for the host.

## Verify the boot

Build the [standalone BusyBox initramfs](../../docs/LINUX.md), then run:

```sh
qemu=/path/to/NanoEmu/emulator/build/qemu-system-arm
initramfs=/path/to/nano-initramfs.cpio.gz
python3 boot-linux.py "$qemu" \
  "$out_dir/arch/arm/boot/zImage" \
  "$out_dir/arch/arm/boot/dts/samsung/s5l8740-n31.dtb" \
  "$initramfs" --log "$out_dir/n31-serial.log"
```

The launcher prepares a temporary RAM image and adds the initramfs addresses
and console arguments to a copy of the DTB. It leaves all inputs intact.
The log contains guest UART3 output and a separate file contains QEMU
diagnostics. The test requires the N31 machine model, `NANO_SMOKE_PASS`,
and the BusyBox root prompt before stopping the emulator.
It ignores terminal control sequences when matching the prompt and allows
up to 150 seconds by default for the Windows-hosted software VM.
Use `--timeout` to adjust the limit for the build host.

The unmodified N31 configuration booted Linux 6.14.0 and recognized
`0x08000000–0x0bffffff` as 64 MiB of RAM. It switched to timer64 and
registered `ttySAC0` at `0x3dd00000`. The test proves the kernel starts
userspace and the guest can read the WAV fixture. UART3 remains
transmit-only, so this test captures a prompt without exercising terminal
input.
