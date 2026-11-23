<p align="center">
  <img src="assets/banner.png" alt="iPod nano 7G - Custom Firmware" width="100%">
</p>

# iPod nano 7G - Custom Firmware

A reproducible way to repack and reflash the iPod nano 7th generation's own
firmware on a device you own. This is not an emulator and it is not a phone
jailbreak - the modified image runs on the nano's native hardware.

Status: work in progress. Tested against one specific stock build; treat
everything here as experimental.

The independent Linux track starts with a RAM-only BusyBox image tested in ARM
QEMU. The emulator and Windows USB diagnostic work while the iPod stays in
normal mode. See [Linux bring-up](docs/LINUX.md) and [USB notes](docs/DFU_NOTES.md).

Jump to: [Flashing](#flashing-the-image) - [If DFU will not engage](#if-dfu-will-not-engage) - [Building](#building-the-image) - [Restoring stock](#restoring-stock) - [Open an issue](#feedback)

---

## What this is

The stock firmware image is unpacked, its resources are modified, and it is
repacked and written back over USB. No signed executable is touched, so the
image still clears the checks the device runs when it installs an update. The
whole point is a build that someone else can reproduce from their own firmware
dump, rather than a prebuilt binary you have to trust.

Apple's firmware is never included here. You bring your own image, dumped from
or matching your own device, and the build repacks it locally.

## Target device

This is tuned for one configuration and nothing else:

| | |
|---|---|
| Device | iPod nano 7th generation |
| Model | MD477LL (2012) |
| Stock build | 1.1.2 (39A10023) |

A different model or build will likely need its own offsets and its own
verification pass before any of this is safe to try.

## Before you touch anything

Read this section twice. The order matters.

- Dump your stock firmware and keep an untouched copy as
  `firmware/Firmware.MSE`. This is your way back. Do not let the build or
  anything else overwrite it.
- Confirm your build string really is `39A10023` before flashing a repack
  built for it.
- A healthy power path matters here. A dead battery can stop the nano from
  reaching the state the flash needs, even on USB power (see below).

## Flashing the image

Once you have a verified repack (`ipod_sun/Firmware-repack.MSE`) and your stock
backup safely aside:

1. Connect the nano to the machine over USB.
2. Put it into DFU mode.
3. Send the repacked image with wInd3x.
4. Wait for the device to come back up on the new firmware.
5. If anything looks wrong, flash `firmware/Firmware.MSE` the same way to return
   to stock.

## If DFU will not engage

This is the live blocker on the test unit, so it gets its own section.

What happens now: holding the button combo makes the screen go dark, the Apple
logo shows, the screen goes dark a second time, and then the nano just boots
normally. Windows drops and re-adds the USB device somewhere in the middle. Held
for a full minute, it still ends up booting normally.

The working theory is power, not buttons. The battery on this unit is dead, and
the ipod_sun notes call out that a non-working battery can keep some devices out
of DFU even while USB is connected. The next useful step is to watch whether
Windows ever enumerates the DFU USB identity during those brief dark moments,
rather than only seeing an ordinary reboot. Notes and findings live in
[docs/DFU_NOTES.md](docs/DFU_NOTES.md).

## Toolchain

| Piece | Used for |
|---|---|
| MSYS2 | Unix-style build environment on Windows |
| Rust nightly-2023-12-20 | Pinned toolchain for the repack tooling |
| wInd3x | DFU transfer / nano recovery over USB |
| Your stock `Firmware.MSE` | Input image, supplied by you |

## Building the image

Working layout:

```text
msys64/              MSYS2 environment
rust/                pinned Rust nightly
wInd3x/              wInd3x build or binary
ipod_sun/            repack project, produces Firmware-repack.MSE
firmware/            your stock Firmware.MSE (kept local, never committed)
tools/               read-only diagnostics
```

Rough flow:

1. Set up MSYS2 and the pinned Rust nightly.
2. Build or drop in the wInd3x binary.
3. Provide your own `firmware/Firmware.MSE`.
4. Run the ipod_sun repack to produce `ipod_sun/Firmware-repack.MSE`.
5. Flash it from DFU as described above.

Your stock image and the repacked output both stay on your machine. See
`.gitignore`.

## Restoring stock

Keep `firmware/Firmware.MSE` untouched for exactly this. If a flash goes wrong
or you simply want to go back, put the device in DFU and write that original
image with wInd3x. That is the recovery path, so protect that file.

## Feedback

Opening an issue is the fastest way to get help. Please include your model and
exact build string, your host OS, which step failed, and what you saw. For DFU
problems specifically, say whether the host ever detected a DFU USB identity
during the attempt - that single detail decides most of the diagnosis.

## Thanks and sources

This project leans on two homebrew efforts and credits them plainly.

- [ipod_sun](https://github.com/CUB3D/ipod_sun) by CUB3D - the firmware repack
  approach this build follows.
- [wInd3x](https://github.com/freemyipod/wInd3x) by freemyipod - the nano DFU
  and USB recovery tooling used to install the image, plus the broader
  freemyipod research the nano scene rests on.

Thanks to everyone in the iPod homebrew community whose reverse engineering and
testing made any of this possible.

## Disclaimer

This is an unofficial homebrew project for hardware you own, with no affiliation
to Apple Inc. iPod and related marks belong to their owners. Nothing in this
repository contains Apple firmware, bootloader code, or other copyrighted Apple
data; you are responsible for using only firmware images you are entitled to
use. Flashing firmware carries a real risk of bricking the device, and that risk
is yours.
