# Phase 4 · Nano 7G display and controls

This bare-metal guest uses NanoEmu's LCD, touch controller, GPIO and PMU.
It needs the [Phase 2 NanoEmu binary](BOARD-SMOKE.md) with the UART3 patch,
an ARM hard-float GCC toolchain, and Python 3 on the Linux build host.

From this directory, build the guest and launch the headless check:

```sh
build_dir=../../out/nano7-display
qemu=/path/to/NanoEmu/emulator/build/qemu-system-arm
mkdir -p "$build_dir"
arm-linux-gnueabihf-gcc -march=armv7-a -mfpu=vfpv3-d16 -marm \
  -O2 -mno-unaligned-access -Wall -Wextra -ffreestanding -fno-pie \
  -nostdlib -static -Wl,-Ttext=0x08000000,--build-id=none,-e,_start \
  -o "$build_dir/display-controls.elf" display-controls.c
arm-linux-gnueabihf-objcopy -O binary \
  "$build_dir/display-controls.elf" "$build_dir/display-controls.bin"
python3 verify-display-controls.py "$qemu" "$build_dir/display-controls.bin" "$build_dir/run"
```

The guest writes a four-color pattern and two touch targets into emulated
DRAM. The verifier compares all 103,680 pixels from the LCD scan-out and
QEMU console, then checks that the 432 × 240 console is an exact clockwise
rotation of the portrait frame.

QMP injects pointer and key events. The guest decodes touch reports over
SPI, reads the volume buttons from GPIO, and reads Home, Power, and
Play/Pause from the PMU over I²C. Its serial log records each transition.
The verifier checks the two portrait touch targets, a rotated touch target,
and one press and release per button.

Compile with `-mno-unaligned-access` because the SPI packet fields can be
at odd addresses and the bare-metal guest starts with the CPU reset
configuration. The guest reports CPU exceptions over UART3.

The output directory contains the verified portrait frame as PNG and both
guest serial and QEMU diagnostic logs. The test uses an open-source guest
with no physical iPod, Apple firmware, or DFU. Linux display and input
drivers are outside this test's coverage.
