# Preview status

## Available from source

- N31 Linux boots to BusyBox under NanoEmu.
- The display guest exercises touch, five buttons, and rotation.
- The audio guest checks I²S samples and volume persistence in an emulated NAND image.
- Windows staging wraps those tests in a portable launcher. Follow the
  [packaging guide](../emulator/nano7/release/BUILD.md) to build a local copy.

The Windows tests use separate demo guests. The Linux mode shows its serial
boot and prompt, then exits. A physical Nano boot and a public Windows binary
download remain pending.

## What is left for a public binary

| Component | Identified input | Remaining distribution work |
| --- | --- | --- |
| Outer Windows QEMU | The QEMU 11.1.0 installer and its publisher checksum are recorded in the packaging guide. The archive also contains 114 DLLs and four ROMs. | Map the copied DLLs and ROMs to the exact upstream builds and notices. Preserve matching source materials for QEMU and the dependencies that require them. |
| ARM NanoEmu | QEMU 9.1.2, pinned NanoEmu revision, and this repo's patches. | Collect the exact sources, patches, configuration, build instructions and notices alongside the release. |
| Linux guest and Debian runtime | The N31 kernel revision is pinned. The Windows runtime includes the Debian host kernel, modules, BusyBox, Python and shared libraries. | Map each shipped binary to the matching package or build, including the ARM BusyBox runtime, and collect the applicable sources and notices. |
| Node.js and optional VNC viewer | Node.js 24.22.3 and TigerVNC 1.16.2 were used in the tested build. | Preserve the vendor notices and verify the exact viewer binary and matching source. |
| Project code | The project's original scripts, docs and guest examples are public in this repo. | Record the project's chosen license and preserve the terms of upstream-derived material. |

QEMU publishes [GPLv2 and component-specific licensing information](https://www.qemu.org/docs/master/about/license.html).
The Windows package's SHA-256 manifest records file identity. Record the collected
notices and source locations separately, then run the packaging guide's acceptance
checks on the exact ZIP that will be distributed.

## Next development work

- Review the Linux framebuffer console and bidirectional UART changes separately
  from the initial preview.
- Add automated full emulator runs once the build inputs and test environment are
  reproducible. On Debian, run `bash tools-check/check-source.sh` from the repository root for syntax checks.
