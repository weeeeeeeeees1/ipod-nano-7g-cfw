"""Load an ARM Linux zImage, N31 DTB and initramfs into NanoEmu's DRAM."""
import argparse
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import time


DRAM = 0x08000000
DRAM_END = 0x0C000000
KERNEL = 0x09000000
DTB = 0x0A000000
INITRAMFS = 0x0A100000
BOOTARGS = "console=ttySAC0,115200 earlyprintk rdinit=/init"
PROMPT = re.compile(rb"(?:^|\r?\n)[^\r\n]*# $", re.MULTILINE)
ANSI_CSI = re.compile(rb"\x1b\[[0-?]*[ -/]*[@-~]")


def boot_image(zimage, dtb, initramfs_path, root, bootargs):
    kernel = zimage.read_bytes()
    if len(kernel) < 0x28 or kernel[0x24:0x28] != b"\x18\x28\x6f\x01":
        raise ValueError("Input kernel is not an ARM zImage")
    initramfs = initramfs_path.read_bytes()
    if not initramfs.startswith(b"\x1f\x8b"):
        raise ValueError("Input initramfs must be a gzip-compressed cpio archive")
    if not dtb.read_bytes().startswith(b"\xd0\x0d\xfe\xed"):
        raise ValueError("Input device tree is not a compiled DTB")

    tree = root / "n31.dtb"
    tree.write_bytes(dtb.read_bytes())
    subprocess.run(["fdtput", "-p", "-t", "s", str(tree), "/chosen", "bootargs", bootargs],
                   check=True)
    for name, address in [
        ("linux,initrd-start", INITRAMFS),
        ("linux,initrd-end", INITRAMFS + len(initramfs)),
    ]:
        subprocess.run(["fdtput", "-t", "x", str(tree), "/chosen", name, f"{address:x}"],
                       check=True)

    # ARM boot protocol: r0 = 0, r1 = ~0, r2 = DTB physical address.
    # At each LDR the architected PC points to its literal, eight bytes ahead.
    stub = struct.pack("<6I", 0xE3A00000, 0xE3E01000, 0xE59F2000, 0xE59FF000, DTB, KERNEL)
    image = root / "linux.bin"
    segments = [
        (DRAM, KERNEL, stub), (KERNEL, DTB, kernel),
        (DTB, INITRAMFS, tree.read_bytes()), (INITRAMFS, DRAM_END, initramfs),
    ]
    with image.open("wb") as destination:
        for address, limit, data in segments:
            if address + len(data) > limit:
                raise ValueError(f"Boot image component at 0x{address:08x} exceeds its RAM slot")
            destination.seek(address - DRAM)
            destination.write(data)


def run(args):
    with tempfile.TemporaryDirectory(prefix="nano7-linux-") as directory:
        root = Path(directory)
        boot_image(args.zimage, args.dtb, args.initramfs, root, args.bootargs)
        serial = root / "serial.log"
        qemu_log = root / "qemu.log"
        passed = False
        failure = "QEMU exited before the BusyBox prompt"
        with qemu_log.open("wb") as stderr:
            process = subprocess.Popen([
                str(args.qemu), "-M",
                "nano7,entry=0x08000000,cpsr=0xd3,os-image=linux.bin,n31-linux-timers=on",
                "-nodefaults", "-display", "none", "-monitor", "none",
                "-nic", "none", "-serial", "file:serial.log",
            ], cwd=root, stdout=subprocess.DEVNULL, stderr=stderr)
            started = time.monotonic()
            try:
                deadline = started + args.timeout
                while process.poll() is None:
                    output = serial.read_bytes() if serial.exists() else b""
                    if b"Kernel panic" in output or b"NANO_SMOKE_FAIL" in output:
                        failure = "the guest reported a failure"
                        break
                    if (b"Machine model: Apple iPod nano (7th generation)" in output and
                            b"NANO_SMOKE_PASS" in output and
                            PROMPT.search(ANSI_CSI.sub(b"", output))):
                        passed = True
                        break
                    if time.monotonic() >= deadline:
                        failure = f"the BusyBox prompt did not arrive within {args.timeout:g} seconds"
                        break
                    time.sleep(0.1)
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()

        serial_bytes = serial.read_bytes() if serial.exists() else b""
        args.log.write_bytes(serial_bytes)
        args.log.with_suffix(".qemu.log").write_bytes(qemu_log.read_bytes())
        print(serial_bytes.decode(errors="replace"), end="")
        if not passed:
            raise SystemExit(f"N31 BusyBox smoke test failed: {failure}. See {args.log} and the QEMU log.")
        print(f"\nPASS: N31 Linux verified the initramfs WAV and reached BusyBox "
              f"({time.monotonic() - started:.1f} seconds).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("qemu", "zimage", "dtb", "initramfs"):
        parser.add_argument(name, type=lambda value: Path(value).resolve(strict=True))
    parser.add_argument("--log", required=True, type=Path)
    parser.add_argument("--bootargs", default=BOOTARGS)
    parser.add_argument("--timeout", type=float, default=150)
    arguments = parser.parse_args()
    if arguments.timeout <= 0:
        parser.error("--timeout must be positive")
    run(arguments)
