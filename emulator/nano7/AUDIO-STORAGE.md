# Phase 5 · Nano 7G audio and volume persistence

The bare-metal player loads a 16-bit, 8 kHz mono WAV from RAM and writes
stereo PCM through NanoEmu's I²S FIFO. Play/Pause and the volume buttons use
the PMU and GPIO paths tested in [Phase 4](DISPLAY-CONTROLS.md). The player
saves its volume in a disposable NAND store through the modeled FMC
controller.

## Build and run

Use the Linux build host and patched NanoEmu checkout from Phase 4. From
this directory:

```sh
nanoemu_dir=/path/to/NanoEmu
build_dir=../../out/nano7-audio
git -C "$nanoemu_dir" apply "$PWD/nano7-nand-partial-record.patch"
bash build-nano7.sh "$nanoemu_dir"
mkdir -p "$build_dir"
arm-linux-gnueabihf-gcc -march=armv7-a -mfpu=vfpv3-d16 -marm \
  -O2 -mno-unaligned-access -Wall -Wextra -ffreestanding -fno-pie \
  -nostdlib -static -Wl,-Ttext=0x08000000,--build-id=none,-e,_start \
  -o "$build_dir/audio-storage.elf" audio-storage.c
arm-linux-gnueabihf-objcopy -O binary \
  "$build_dir/audio-storage.elf" "$build_dir/audio-storage.bin"
python3 verify-audio-storage.py "$nanoemu_dir/emulator/build/qemu-system-arm" \
  "$build_dir/audio-storage.bin" "$build_dir/run"
```

## Acceptance checks

- The first process starts at full volume, pauses partway through the
  tone, changes the volume in both directions, and resumes at the same
  sample. Its captured stereo WAV matches the expected volume on both
  sides of the pause.
- A fresh QEMU process opens the same NAND store, reads volume level 3,
  and captures the whole tone at the restored level.
- A third launch repeats the restore test with an older short record.
  The verifier retains the header and first sector of the same store to
  reproduce the previous format.

Each capture must contain exactly 8,000 frames at 8 kHz, and the verifier
compares every sample in both channels. The output directory contains the
WAV captures, guest serial logs, and QEMU diagnostics. The input WAV and
NAND store are temporary files created by the verifier.

The NAND patch fixes the reopen behavior for a page with only one
programmed sector. The writer now extends the sparse file to the page
boundary before committing its header, and the reader can reopen an older
trailing record if its header and requested sector are present.

This test covers guest PCM output and a synthetic setting in emulated
NAND. Live speaker playback, Linux audio drivers, and music library
access have separate verification needs. The test requires no physical
iPod or DFU.
