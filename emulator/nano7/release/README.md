# Nano 7G emulator for Windows

Extract the whole archive to a writable folder on Windows x64.
Double-click `Start-Nano7.cmd` for the menu or open that folder in a
terminal. The archive includes Node.js and the emulator runtime.

```cmd
Start-Nano7.cmd linux
Start-Nano7.cmd display
Start-Nano7.cmd audio --play
Start-Nano7.cmd check
```

- **Linux** boots the N31 kernel with 64 MiB of emulated RAM, checks the
  fixture in BusyBox, and exits after the serial prompt. UART3 supports
  transmit only in this build.
- **Display** opens the standalone VNC viewer when it is bundled. Click
  or drag the test pattern to send touch input. Use **H** for Home,
  **P** for the Power button, **Space** for Play/Pause, and the **arrow
  keys** for volume. **F7** rotates the console. The firmware-free guest
  reports the input events in the launcher terminal. Press **Ctrl+C** in
  that terminal to exit. When using your own viewer, connect to
  `127.0.0.1::5907`. Set `NANO7_VNC_PORT` to use a different loopback port.
- **Audio** tests pause, resume, volume and persistence, then saves the
  captured WAV. The optional `--play` switch plays it through Windows
  after verification.
- **Check** runs the Linux, automated display and controls, and audio
  checks. It takes longer under software emulation.

Each launch saves logs in its own subfolder under `runs`. The display
demo and the WAV tests use separate open-source guests. The release
contains a small Linux runtime and uses software emulation on Windows.
It requires no connected iPod or DFU. Stock RetailOS boot and installing
software on a physical Nano are outside this release's coverage.

## Rebuild from source

Use the patched NanoEmu revision from the Phase 1–5 build guides, an
N31 kernel build from freemyipod Linux commit
`043ef51472d3471d525fbb55248c84039946d5b7`, and the standalone Phase 3
BusyBox initramfs. Use a Debian 12 x86-64 build host running its cloud
kernel. The runtime builder takes its x86 kernel and matching modules
from that host.

```sh
sudo apt-get install busybox-static cpio kmod gzip binutils \
  gcc-arm-linux-gnueabihf python3.11 device-tree-compiler
bash build-runtime.sh /path/to/qemu-system-arm /path/to/n31-build \
  /path/to/n31-initramfs.cpio.gz /path/to/debian-runtime
```

Copy the runtime output to Windows and stage it against an extracted
Windows x64 QEMU distribution. Prepare a directory with the standalone
Windows x64 Node.js binary named `node.exe` and the matching Node.js
`LICENSE` file. Verify the binary against Node.js's published SHA-256
checksums. Optionally supply a standalone Windows VNC viewer. The
portable build uses Node.js 24.22.3 and TigerVNC 1.16.2.

```cmd
node stage-windows.mjs QEMU_DIR DEBIAN_RUNTIME NODE_DIR RELEASE_DIR VNC_VIEWER.exe
```

Source and dependency references:

- [NanoEmu source at the pinned revision](https://github.com/tenspav/NanoEmu/tree/b9bc90a9d74b07d0e598598e86ee605344607048)
- [QEMU 9.1.2 source used for NanoEmu](https://download.qemu.org/qemu-9.1.2.tar.xz)
- [Windows QEMU builds and sources](https://qemu.weilnetz.de/w64/2026/)
- [freemyipod N31 Linux source](https://github.com/freemyipod/linux/tree/043ef51472d3471d525fbb55248c84039946d5b7)
- [Debian source packages](https://sources.debian.org/)
- [Node.js 24.22.3 binaries, checksums, and source](https://nodejs.org/en/blog/release/v24.22.3)
- [TigerVNC 1.16.2 binaries and source](https://github.com/TigerVNC/tigervnc/releases/tag/v1.16.2)
