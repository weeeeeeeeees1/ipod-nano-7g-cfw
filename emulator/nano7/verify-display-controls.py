"""Verify NanoEmu LCD scan-out and guest-observed pointer and key events."""
import argparse
import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import time
import zlib

from nano7_qmp import TIMEOUT, command, connect_qmp, wait_for


WIDTH, HEIGHT = 240, 432
TARGETS = ((30, 54), (199, 377))
COLORS = (b"\xff\x00\x00", b"\x00\xff\x00", b"\x00\x00\xff", b"\xff\xff\x00")
PPM_HEADER = f"P6\n{WIDTH} {HEIGHT}\n255\n".encode()


def expected_pixels():
    return b"".join(
        b"\xff" * 3 if any(abs(x - cx) <= 2 and abs(y - cy) <= 2 for cx, cy in TARGETS)
        else COLORS[2 * (y >= HEIGHT // 2) + (x >= WIDTH // 2)]
        for y in range(HEIGHT) for x in range(WIDTH)
    )


def scanout(directory, expected):
    for frame in sorted(directory.glob("screen-*.ppm")):
        data = frame.read_bytes()
        if data == PPM_HEADER + expected:
            return data
    return None


def png(pixels):
    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data +
                struct.pack(">I", zlib.crc32(kind + data)))

    row_bytes = WIDTH * 3
    rows = b"".join(b"\0" + pixels[i:i + row_bytes] for i in range(0, len(pixels), row_bytes))
    return (b"\x89PNG\r\n\x1a\n" +
            chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


def events_match(serial, expected):
    output = serial.read_bytes() if serial.exists() else b""
    if b"IO FAIL" in output:
        raise RuntimeError(f"Guest reported a device error: {output!r}")
    complete = output.split(b"\n")[:-1]
    if complete != expected[:len(complete)]:
        raise RuntimeError(f"Unexpected guest events: {complete!r}, expected {expected!r}")
    return output if complete == expected else None


def pointer(x, y, width=WIDTH, height=HEIGHT):
    return [
        {"type": "abs", "data": {"axis": axis, "value": (2 * pixel + 1) * 32768 // (2 * size)}}
        for axis, pixel, size in [("x", x, width), ("y", y, height)]
    ]


def key_event(key, pressed):
    return {"type": "key", "data": {
        "down": pressed, "key": {"type": "qcode", "data": key},
    }}


def check_console(stream, root, expected, width, height):
    command(stream, "screendump", {"filename": "console.ppm"})
    header = f"P6\n{width} {height}\n255\n".encode()
    if (root / "console.ppm").read_bytes() != header + expected:
        raise RuntimeError(f"Console does not match the {width} × {height} panel image")


def send_and_check(process, stream, serial, expected, events, marker):
    expected.append(marker.encode())
    command(stream, "input-send-event", {"events": events})
    wait_for(process, lambda: events_match(serial, expected), marker)


def verify(qemu, guest, output):
    output.mkdir(parents=True, exist_ok=True)
    serial = output / "display-controls.serial.log"
    serial.unlink(missing_ok=True)
    pixels = expected_pixels()
    with tempfile.TemporaryDirectory(prefix="nano7-display-") as directory:
        root = Path(directory)
        (root / "guest.bin").write_bytes(guest.read_bytes())
        (root / "frames").mkdir()
        with (output / "display-controls.qemu.log").open("wb") as log:
            process = subprocess.Popen([
                qemu, "-M", "nano7,entry=0x08000000,os-image=guest.bin,disp-dump=frames",
                "-S", "-nodefaults", "-nic", "none", "-display", "none",
                "-serial", f"file:{serial}", "-monitor", "none",
                "-qmp", "unix:qmp.sock,server=on,wait=off",
            ], cwd=root, stdout=subprocess.DEVNULL, stderr=log,
                env={**os.environ, "NANO7_HUD": "0", "NANO7_FRAME": "0", "NANO7_ZOOM": "1"})
            try:
                with wait_for(process, lambda: connect_qmp(root / "qmp.sock"), "QMP") as connection:
                    with connection.makefile("rwb") as stream:
                        if "QMP" not in json.loads(stream.readline()):
                            raise RuntimeError("Invalid QMP greeting")
                        command(stream, "qmp_capabilities")
                        command(stream, "cont")
                        expected = [b"IO READY"]
                        wait_for(process, lambda: events_match(serial, expected), "guest readiness")
                        frame = wait_for(process, lambda: scanout(root / "frames", pixels), "exact LCD frame")
                        (output / "nano7-test-pattern.png").write_bytes(png(frame[len(PPM_HEADER):]))
                        check_console(stream, root, pixels, WIDTH, HEIGHT)
                        print(f"PASS: all {WIDTH * HEIGHT} scanned-out pixels match.")
                        for state, x, y, button in [(3, *TARGETS[0], True),
                                                     (4, *TARGETS[1], None),
                                                     (5, *TARGETS[1], False)]:
                            events = pointer(x, y) if button is not False else []
                            if button is not None:
                                events.append({"type": "btn", "data": {"down": button, "button": "left"}})
                            send_and_check(process, stream, serial, expected, events, f"T {state} {x:03} {y:03}")
                        print("PASS: touch press, drag and release match the guest coordinates.")
                        for button, key in enumerate(("up", "down", "h", "p", "spc")):
                            for pressed in (True, False):
                                send_and_check(process, stream, serial, expected, [key_event(key, pressed)],
                                               f"B {button} {int(pressed)}")
                        command(stream, "input-send-event", {"events": [key_event("f7", True)]})
                        command(stream, "input-send-event", {"events": [key_event("f7", False)]})
                        rotated = b"".join(
                            pixels[offset:offset + 3]
                            for x in range(WIDTH)
                            for y in range(HEIGHT - 1, -1, -1)
                            for offset in [3 * (y * WIDTH + x)]
                        )
                        check_console(stream, root, rotated, HEIGHT, WIDTH)
                        x, y = TARGETS[0]
                        rotated_target = pointer(HEIGHT - 1 - y, x, HEIGHT, WIDTH)
                        for state, pressed in ((3, True), (5, False)):
                            events = rotated_target + [{"type": "btn", "data": {
                                "down": pressed, "button": "left",
                            }}]
                            send_and_check(process, stream, serial, expected, events, f"T {state} {x:03} {y:03}")
                        print("PASS: 90-degree console rotation preserves the picture and touch coordinates.")
                        time.sleep(0.35)
                        command(stream, "stop")
                        if events_match(serial, expected) is None:
                            raise RuntimeError("Missing guest events at shutdown")
                        command(stream, "quit")
                if process.wait(timeout=TIMEOUT):
                    raise RuntimeError(f"QEMU exited with status {process.returncode}")
                print("PASS: Volume Up, Volume Down, Home, Power and Play/Pause each sent one press and release.")
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("qemu", type=Path)
    parser.add_argument("guest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    verify(args.qemu.resolve(strict=True), args.guest.resolve(strict=True), args.output.resolve())
