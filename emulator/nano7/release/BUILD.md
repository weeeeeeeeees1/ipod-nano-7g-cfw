# Build the Windows preview

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
- [Windows QEMU 11.1.0 installer](https://qemu.weilnetz.de/w64/2026/qemu-w64-setup-20260811.exe)
  and [publisher SHA-512](https://qemu.weilnetz.de/w64/2026/qemu-w64-setup-20260811.sha512).
  The local installer matched that SHA-512 and its x86-64 executable matched the existing bundle.
  Installer SHA-256: `F98A8AEB5F7FAEA9765B6DEE28316C266CD179D80354A2FED8E50176F9A2E59F`.
- [freemyipod N31 Linux source](https://github.com/freemyipod/linux/tree/043ef51472d3471d525fbb55248c84039946d5b7)
- [Debian source packages](https://sources.debian.org/)
- [Node.js 24.22.3 binaries, checksums, and source](https://nodejs.org/en/blog/release/v24.22.3)
- [TigerVNC 1.16.2 binaries and source](https://github.com/TigerVNC/tigervnc/releases/tag/v1.16.2)

## Prepare a release candidate

1. Follow the [board build](https://github.com/weeeeeeeeees1/ipod-nano-7g-cfw/blob/main/emulator/nano7/BOARD-SMOKE.md), [N31 Linux build](https://github.com/weeeeeeeeees1/ipod-nano-7g-cfw/blob/main/emulator/nano7/LINUX-BOOT.md),
   and [audio and storage build](https://github.com/weeeeeeeeees1/ipod-nano-7g-cfw/blob/main/emulator/nano7/AUDIO-STORAGE.md). Run their verifiers.
2. Record the project commit, Debian package versions, and the exact URLs
   and SHA-256 hashes for the QEMU, Node.js, and viewer downloads.
3. Stage into a new directory. Keep the generated runtime build report and
   file hashes with the candidate. Archive the entire staging directory.
4. Inventory the bundled binaries, libraries, ROMs, and kernels. Include the
   required notices and exact corresponding source materials or an applicable
   distribution mechanism for each component. Keep Apple firmware out of the ZIP.
5. With Node.js absent from PATH, extract to a fresh directory with spaces
   on Windows x64. Run `Start-Nano7.cmd check` and verify `NANO7_RESULT OK check`.
   Open Display separately and check touch and Home.
6. Upload the verified ZIP and its SHA-256 as prerelease assets. Include the
   tested host, demo scope, and physical boot status in the release notes.
