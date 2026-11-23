# Phase 2 · Nano 7G board smoke test

The test runs a small ARM assembly guest on NanoEmu's `nano7` machine. The
guest is loaded into emulated DRAM and uses no Apple firmware, snapshot, USB
passthrough, or physical iPod.

## Build and run

Start with the [Phase 1 build guide](README.md). Apply the following patches
after the compiler-warning patch from Phase 1, before building NanoEmu.
Run the commands from this directory on the Linux build host and set
`nanoemu_dir` to the checkout from Phase 1.

```sh
sudo apt-get install --no-install-recommends binutils-arm-none-eabi
nanoemu_dir=/path/to/NanoEmu
git -C "$nanoemu_dir" apply "$PWD/nano7-uart3.patch"
git -C "$nanoemu_dir" apply "$PWD/nano7-n31-linux-timers.patch"
bash build-nano7.sh "$nanoemu_dir"
qemu="$nanoemu_dir/emulator/build/qemu-system-arm"
build_dir=../../out/nano7
mkdir -p "$build_dir"

arm-none-eabi-as -o "$build_dir/board-smoke.o" board-smoke.S
arm-none-eabi-ld -Ttext=0x08000000 -e _start -o "$build_dir/board-smoke.elf" "$build_dir/board-smoke.o"
arm-none-eabi-objcopy -O binary "$build_dir/board-smoke.elf" "$build_dir/board-smoke.bin"
python3 verify-board.py "$qemu" "$build_dir/board-smoke.bin"

arm-none-eabi-as --defsym N31_LINUX_TIMERS=1 -o "$build_dir/board-linux.o" board-smoke.S
arm-none-eabi-ld -Ttext=0x08000000 -e _start -o "$build_dir/board-linux.elf" "$build_dir/board-linux.o"
arm-none-eabi-objcopy -O binary "$build_dir/board-linux.elf" "$build_dir/board-linux.bin"
python3 verify-board.py "$qemu" "$build_dir/board-linux.bin" --linux-timers
```

## Acceptance checks

| Check | Evidence |
| --- | --- |
| DRAM and IRAM | The guest writes distinct words near both ends of each modeled region and reads them back after all writes. |
| Serial | The guest polls UART3 at `0x3dd00000` and writes each marker through its transmit register. |
| Default timer | Timer B asserts IRQ 8 twice. The ARM IRQ handler reads the VIC, checks the pending bit, acknowledges it, and verifies the line cleared. |
| Linux timer | With `n31-linux-timers=on`, the guest also programs Timer E as a one-shot, verifies IRQ 7, reads the separate status register and clears the interrupt through the latch. It uses timer64 to check that the programmed delay elapsed. |
| Reset | After a full pass, QMP `system_reset` restores the initial boot state. The guest checks its RAM sentinel, VIC enable bits and configured timer periods before repeating the tests. |

The opt-in timer variant follows the
[N31 device tree](https://github.com/freemyipod/linux/blob/043ef51472d3471d525fbb55248c84039946d5b7/arch/arm/boot/dts/samsung/s5l8740-n31.dts)
and the [S5L8720 Linux timer driver](https://github.com/freemyipod/linux/blob/043ef51472d3471d525fbb55248c84039946d5b7/drivers/clocksource/timer-s5l8720.c).
The tested configuration models Timer E at 1 MHz with prescaler 23 and
timer64 at 2 MHz. NanoEmu still uses a Cortex-A7 stand-in for Cortex-A5,
and the UART3 patch models polled output only. Linux kernel boot and UART
receive interrupts need separate validation.
