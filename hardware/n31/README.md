# N31 Linux payload handoff

This is a RAM-only Linux test payload for the iPod nano 7th generation
(N31, S5L8740). The FIT contains the same ARM kernel, board DTB, and BusyBox
initramfs listed separately in [SHA256SUMS.txt](SHA256SUMS.txt).

| File | Purpose |
| --- | --- |
| `nano7-n31-busybox-ram.itb` | FIT for a loader that already accepts this image format |
| `zImage` | ARM Linux 6.14.0 kernel |
| `s5l8740-n31.dtb` | Board device tree |
| `nano-pr-initramfs.cpio.gz` | RAM root filesystem with BusyBox and a WAV fixture |

## Tested scope

NanoEmu loaded the individual components extracted from the FIT and reached
BusyBox after printing `NANO_SMOKE_PASS`. The physical Nano and the U-Boot
handoff are both unverified. The observed reference device was a 2012
MD477LL displaying **1.1.2 PC**. Build `39A10023` identifies the inspected
stock firmware package. The installed build number was not independently
read. No stock hardware or firmware combination has passed this payload.

The FIT belongs at a loader handoff. The repository has no supported
first-stage installer that starts it on a stock Nano. A loader maintainer
should confirm the accepted image format, board and firmware prerequisites,
device tree handling, serial output, and RAM boot behavior before using a
physical unit.

## Source and build inputs

- Linux and the N31 DTB come from [freemyipod Linux commit
  043ef51472d3471d525fbb55248c84039946d5b7](https://github.com/freemyipod/linux/tree/043ef51472d3471d525fbb55248c84039946d5b7),
  built with `apple_n31_defconfig` and Debian's ARM hard-float GCC
  12.2.0 (Debian 12.2.0-14). See the [N31 build
  guide](https://github.com/weeeeeeeeees1/ipod-nano-7g-cfw/blob/0733a82b82482ee1f94600a1769b45508c8228b7/emulator/nano7/LINUX-BOOT.md).
- The initramfs uses the [project's
  builder](https://github.com/weeeeeeeeees1/ipod-nano-7g-cfw/blob/0733a82b82482ee1f94600a1769b45508c8228b7/linux/build-initramfs.mjs)
  and static ARMv7 BusyBox from Alpine v3.22's
  [busybox-static 1.37.0-r20 package](https://dl-cdn.alpinelinux.org/alpine/v3.22/main/armv7/busybox-static-1.37.0-r20.apk).
  Its package metadata records Alpine aports commit `2e97d754a30d558f15524b8e422303c8a96832df`.
  The package SHA-256 is
  `55e39186265e926497325a5ae63b53581ce3f687820af2e083e86b3299541766`.
  The extracted `bin/busybox.static` SHA-256 is
  `cb8bbf2ca87292c394369b1bfc9e5c0288f82347ead1f79ebad2b60d8abf6921`.
- The FIT uses the [upstream N31 image
  description](https://github.com/freemyipod/linux/blob/043ef51472d3471d525fbb55248c84039946d5b7/freemyipod/kernel_fdt_n31.its)
  and the `conf-1` configuration. It carries no first-stage loader or Apple firmware.

From a directory containing the four binaries and the checksum file, run
`sha256sum -c SHA256SUMS.txt` on Linux. On Windows, compare each
`Get-FileHash` result against the checksum file.
