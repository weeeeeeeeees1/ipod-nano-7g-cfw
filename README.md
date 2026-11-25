# iPod nano 7G emulator and Linux development

Boot a small Linux system for the iPod nano 7th generation (N31) in NanoEmu.
The portable Windows x64 preview needs no iPod, Apple firmware, or separate Node.js installation.

## Try it on Windows

1. Download the Windows x64 ZIP from [Releases](https://github.com/weeeeeeeeees1/ipod-nano-7g-cfw/releases).
   If no preview is listed, follow the source build links below.
2. Run `Get-FileHash .\nano7-windows-x64.zip` in PowerShell and compare its SHA-256 with the release notes.
3. Extract the entire archive to a writable folder. Double-click `Start-Nano7.cmd` for the menu or run
   `.\Start-Nano7.cmd check` in PowerShell for the automated smoke test.

| Mode | What it does |
| --- | --- |
| Linux | Boots the N31 kernel to BusyBox and shows the serial log. |
| Display | Demonstrates touch, buttons, and rotation in a separate demo guest. |
| Audio | Captures a test WAV and checks volume persistence in emulated storage. |
| Check | Runs the automated Linux, display, input, and audio checks. |

See the [Windows guide](emulator/nano7/release/README.md) for controls, troubleshooting, and logs.

## Build or contribute

- [Build NanoEmu and run the board tests](emulator/nano7/README.md)
- [Build the N31 kernel and boot BusyBox](emulator/nano7/LINUX-BOOT.md)
- [Build and package the Windows preview](emulator/nano7/release/BUILD.md)
- [Report issues and contribute](CONTRIBUTING.md)

## Hardware status

Linux has booted to BusyBox in the emulator. Booting Linux on a physical Nano remains pending.
The original hardware research targeted an MD477LL showing firmware 1.1.2 PC.
See the [hardware observations](docs/DFU_NOTES.md).

The emulator work builds on [NanoEmu](https://github.com/tenspav/NanoEmu),
[QEMU](https://www.qemu.org/), and [freemyipod's Linux port](https://github.com/freemyipod/linux).
Earlier hardware research references ipod_sun and freemyipod.
