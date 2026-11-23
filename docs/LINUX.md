# Linux bring-up for the Nano 7G

The first milestone is a standalone ARM initramfs that checks a bundled PCM
WAV and reaches a BusyBox prompt. The smoke test uses QEMU's generic ARM
`virt` board with 64 MiB of RAM, a serial console, and networking disabled.
It requires no iPod access.

For the Nano-specific emulator build and headless launch test, see the
[Phase 1 build guide](../emulator/nano7/README.md).

## Reproduce the emulator test

Use Node.js, `tar`, and QEMU's `qemu-system-arm`. From the repository root in
Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force downloads, out | Out-Null
curl.exe -fL https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/armv7/netboot/vmlinuz-lts -o downloads/vmlinuz-lts
curl.exe -fL https://dl-cdn.alpinelinux.org/alpine/v3.22/main/armv7/busybox-static-1.37.0-r20.apk -o downloads/busybox.apk
tar -xf downloads/busybox.apk -C downloads bin/busybox.static
node linux/build-initramfs.mjs downloads/bin/busybox.static out/nano-initramfs.cpio.gz
node emulator/smoke.mjs downloads/vmlinuz-lts out/nano-initramfs.cpio.gz
```

Pass the QEMU executable as the optional third argument to the smoke script
if it is outside PATH. Give the builder a fresh output path for a rebuild.
The Alpine kernel URL can advance within its release branch. A successful
run prints `NANO_SMOKE_PASS` and reaches a root prompt before the host stops
the emulator. The test verifies the sample's header and length inside the
guest. Playback requires an audio driver and separate testing.

## N31 kernel work

The [freemyipod Linux revision inspected here](https://github.com/freemyipod/linux/tree/043ef51472d3471d525fbb55248c84039946d5b7)
already includes `apple_n31_defconfig`, `s5l8740-n31.dts`, and a FIT
description. The device tree describes a Cortex-A5, 64 MiB RAM, UART3,
interrupt controllers, a timer, USB peripheral mode, and the LCD interface.
The kernel configuration enables the LCD driver and framebuffer console.
The volume keys have active device tree entries. Home, power, and
play/pause are disabled because of I²C polling problems.

On a Linux build host with kernel build dependencies and an ARM hard-float
cross-compiler, use the pinned upstream checkout to prepare the kernel and
device tree. These build commands have not been run on this Windows host:

```sh
make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- O=out-n31 apple_n31_defconfig
make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- O=out-n31 -j"$(nproc)" zImage samsung/s5l8740-n31.dtb
```

The N31 config uses `ttySAC0` for its serial console. The RAM-only initramfs
needs no NAND root filesystem. Starting the kernel on physical hardware
requires a supported launch path. The connected unit is currently in normal
USB mode, and a native launch path for that state has yet to be verified.

The hardware acceptance test starts with a kernel log and BusyBox prompt.
Then verify the framebuffer and volume key events, followed by headphone
playback of the WAV fixture. Keep NAND music-library access for a later
milestone. For stock-firmware app development, the [NanoApps SDK](https://github.com/nfzerox/NanoApps)
is a separate option, with runtime compatibility on this unit still unverified.
