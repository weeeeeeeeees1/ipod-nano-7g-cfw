# IPOD NANO 7G CUSTOM FIRMWARE, DEV IN PROGRESS!

<p align="center">
  <a href="#install-start-here"><strong>INSTALL</strong></a>
  &nbsp;·&nbsp;
  <a href="#how-it-works"><strong>HOW IT WORKS</strong></a>
  &nbsp;·&nbsp;
  <a href="#current-status"><strong>STATUS</strong></a>
  &nbsp;·&nbsp;
  <a href="#report-a-bug"><strong>REPORT A BUG</strong></a>
</p>

Custom firmware for the Apple iPod nano 7th generation, built by repacking the
stock firmware image and installing it over USB with the freemyipod toolchain.
This is not a jailbreak of a phone and it is not an emulator. It runs on the
iPod's own hardware.

No Apple firmware is included in this repository. You must provide your own
firmware image, dumped or downloaded from your own device. The build process
repacks that image locally and never redistributes Apple code.

## Device target

- Apple iPod nano 7th generation
- Model: MD477LL (2012)
- Stock firmware: 1.1.2, build 39A10023

Other Nano 7G models and builds are untested. The repack and install steps are
specific to this build, so a different firmware version may need its own
offsets and verification.

## Install: start here

This is experimental software for a device you own. Back up your original
firmware before you begin. The modified image differs from stock only in
resources; no signed executable code is changed.

1. Dump or obtain the stock firmware for your exact model and build.
2. Keep an untouched copy as `firmware/Firmware.MSE`. This is your recovery
   image. Do not overwrite it.
3. Build the repacked image (see Build below). The result is
   `ipod_sun/Firmware-repack.MSE`.
4. Put the iPod into DFU mode and install the repacked image with wInd3x.
5. Let the device reboot into the custom firmware.

If anything goes wrong, reinstall your original `Firmware.MSE` the same way.

## How it works

This project stands on two upstream homebrew tools and adds a documented,
reproducible build for one specific Nano 7G build.

1. The stock `Firmware.MSE` is unpacked and its resources are modified. No
   signed executable is replaced, so the image still passes the checks the
   device performs at install time.
2. The modified resources are repacked into `Firmware-repack.MSE`.
3. The device is placed in DFU mode and the repacked image is sent over USB
   with wInd3x, which handles the Nano 7G recovery protocol.
4. The original `Firmware.MSE` is kept as a known-good recovery image so the
   device can always be returned to stock.

The toolchain runs on Windows with MSYS2 and a pinned Rust nightly. Exact
versions are listed under Build so the result is reproducible.

## Current status

> Fill these in to match your device. Keep claims to what you have actually
> verified on hardware.

- [ ] Original firmware backed up and verified
- [ ] Repacked image builds reproducibly
- [ ] Device enters DFU mode reliably
- [ ] Repacked image installs over USB
- [ ] Device boots the custom firmware
- [ ] Recovery to stock confirmed working

### Known blocker

DFU entry currently fails on this unit. The observed sequence is: screen goes
black, Apple logo appears, screen goes black again, then the device boots
normally, while Windows disconnects and reconnects the USB device. The battery
on this unit is dead, and the ipod_sun notes mention that a nonfunctional
battery can prevent some devices from entering DFU even while connected to USB
power. Diagnosing this is the current priority. See
[docs/DFU_NOTES.md](docs/DFU_NOTES.md).

## Requirements

- Windows with MSYS2
- Rust nightly-2023-12-20
- wInd3x
- A USB cable and the target iPod nano 7G
- Your own stock firmware image for the matching build

## Build

The working layout for this project:

```text
msys64/                       MSYS2 environment
iPodLinux/rust/               pinned Rust nightly toolchain
iPodLinux/wInd3x/             wInd3x build / executable
iPodLinux/ipod_sun/           repack project and Firmware-repack.MSE
iPodLinux/firmware/           original Firmware.MSE (recovery image, untracked)
iPodLinux/tools/              read-only diagnostic tools
```

Build steps:

1. Install MSYS2 and the pinned Rust nightly.
2. Build or place the wInd3x executable.
3. Supply your own `firmware/Firmware.MSE`.
4. Run the ipod_sun repack to produce `ipod_sun/Firmware-repack.MSE`.
5. Install with wInd3x from DFU mode.

The original firmware image and the repacked output stay local to your machine
and are never committed. See `.gitignore`.

## Report a bug

Open an issue with your exact model, firmware build, host OS, the step that
failed, and what you observed. For DFU problems, include whether Windows
detected a DFU USB identity during the attempt.

## Credits

### CUB3D, ipod_sun

The [ipod_sun](https://github.com/CUB3D/ipod_sun) project provides the firmware
repack approach this build is based on.

### freemyipod, wInd3x

[wInd3x](https://github.com/freemyipod/wInd3x) provides the Nano 7G DFU and USB
recovery tooling used to install the image, and the freemyipod project's
research underpins Nano-generation homebrew in general.

Thank you to everyone in the iPod homebrew community whose reverse engineering,
testing, and open source work made this possible.

## Legal

This is an unofficial homebrew project for hardware you own. It is not
affiliated with Apple Inc. iPod and related names belong to their respective
owners. This repository does not contain Apple firmware, bootloader code, or
other copyrighted Apple data. You are responsible for only using firmware
images you are entitled to use.
