"""Check PCM playback, pause, volume, and volume persistence on NanoEmu."""
import argparse
import json
import math
from pathlib import Path
import struct
import subprocess
import tempfile
import wave

from nano7_qmp import TIMEOUT, command, connect_qmp, wait_for


RATE = 8000
FRAMES = RATE
TRACK_OFFSET = 0x100000
NAND_HEADER = 0x80
NAND_SECTOR = 4096
NAND_PAGE_RECORD = NAND_HEADER + 4 * NAND_SECTOR


def make_track(path):
    samples = [round(math.sin(2 * math.pi * 440 * i / RATE) * 8000 *
                     min(i / 80, (FRAMES - 1 - i) / 80, 1)) for i in range(FRAMES)]
    with wave.open(str(path), "wb") as track:
        track.setparams((1, 2, RATE, FRAMES, "NONE", "not compressed"))
        track.writeframes(struct.pack(f"<{FRAMES}h", *samples))
    return samples


def serial_lines(serial):
    data = serial.read_bytes() if serial.exists() else b""
    if b"IO FAIL" in data:
        raise RuntimeError(f"Guest reported a device error: {data!r}")
    return data.decode().split("\n")[:-1]


def expect(process, serial, marker, count=1):
    def condition():
        matches = [line for line in serial_lines(serial) if line.startswith(marker)]
        return matches[count - 1] if len(matches) >= count else None

    return wait_for(process, condition, repr(marker))


def key(stream, name, down):
    command(stream, "input-send-event", {"events": [{
        "type": "key", "data": {"down": down, "key": {"type": "qcode", "data": name}},
    }]})


def launch(qemu, root, serial, diagnostic, mode):
    boundary = None
    with diagnostic.open("wb") as log:
        process = subprocess.Popen([
            qemu, "-M",
            "nano7,entry=0x08000000,os-image=../player.bin,nand-store=../settings.nand,audio-out=capture.wav",
            "-S", "-nodefaults", "-nic", "none", "-display", "none",
            "-serial", f"file:{serial}", "-monitor", "none",
            "-qmp", "unix:qmp.sock,server=on,wait=off",
        ], cwd=root, stdout=subprocess.DEVNULL, stderr=log)
        try:
            with wait_for(process, lambda: connect_qmp(root / "qmp.sock"), "QMP") as connection:
                with connection.makefile("rwb") as stream:
                    if "QMP" not in json.loads(stream.readline()):
                        raise RuntimeError("Invalid QMP greeting")
                    command(stream, "qmp_capabilities")
                    command(stream, "cont")
                    expect(process, serial, "A DEFAULT 00004" if mode == "program" else "A LOADED 00003")
                    expect(process, serial, "A READY")
                    if mode == "legacy":
                        command(stream, "quit")
                        if process.wait(timeout=TIMEOUT):
                            raise RuntimeError(f"QEMU exited with status {process.returncode}")
                        return None
                    key(stream, "spc", True)
                    expect(process, serial, "A PLAY 00000")
                    key(stream, "spc", False)
                    expect(process, serial, "A STARTED")
                    expect(process, serial, "A KEY UP")
                    if mode == "program":
                        key(stream, "spc", True)
                        pause = expect(process, serial, "A PAUSE ")
                        boundary = int(pause.split()[-1])
                        if not 0 < boundary < FRAMES:
                            raise RuntimeError(f"Pause was outside playback: {pause}")
                        key(stream, "spc", False)
                        expect(process, serial, "A KEY UP", 2)
                        for index, (button, volume, occurrences) in enumerate(
                            [("down", 3, 1), ("up", 4, 1), ("down", 3, 2)], start=1
                        ):
                            key(stream, button, True)
                            expect(process, serial, f"A VOLUME {volume:05d}", occurrences)
                            key(stream, button, False)
                            expect(process, serial, "A VOLUME KEY UP", index)
                        key(stream, "spc", True)
                        expect(process, serial, f"A PLAY {boundary:05d}")
                        key(stream, "spc", False)
                    expect(process, serial, f"A DONE {FRAMES:05d}")
                    command(stream, "quit")
            if process.wait(timeout=TIMEOUT):
                raise RuntimeError(f"QEMU exited with status {process.returncode}")
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
    return boundary


def verify_capture(path, samples, boundary):
    with wave.open(str(path), "rb") as capture:
        actual = (capture.getnchannels(), capture.getsampwidth(), capture.getframerate(),
                  capture.getnframes())
        if actual != (2, 2, RATE, FRAMES):
            raise RuntimeError(f"Unexpected WAV format: {actual}")
        pcm = capture.readframes(FRAMES)
    expected = bytearray()
    for index, sample in enumerate(samples):
        level = sample if index < boundary else int(sample * 3 / 4)
        expected.extend(struct.pack("<hh", level, level))
    if pcm != expected:
        raise RuntimeError("Captured I2S samples differ from the reference PCM")


def verify(qemu, guest, output):
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="nano7-audio-") as directory:
        root = Path(directory)
        track = root / "tone.wav"
        samples = make_track(track)
        code = guest.read_bytes()
        if not code or len(code) >= TRACK_OFFSET:
            raise ValueError("Guest image overlaps the WAV slot")
        with (root / "player.bin").open("wb") as image:
            image.write(code)
            image.seek(TRACK_OFFSET)
            image.write(track.read_bytes())
        storage = root / "settings.nand"
        for index, mode in enumerate(("program", "reopen", "legacy"), start=1):
            if mode == "legacy":
                # The original FMC implementation wrote a header and sector only.
                with storage.open("r+b") as old_record:
                    old_record.truncate(NAND_HEADER + NAND_SECTOR)
            instance = root / f"run{index}"
            instance.mkdir()
            serial = output / f"audio-run{index}.serial.log"
            serial.unlink(missing_ok=True)
            boundary = launch(qemu, instance, serial, output / f"audio-run{index}.qemu.log", mode)
            if mode == "legacy":
                print(serial.read_text(), end="")
                break
            if mode == "program" and storage.stat().st_size != NAND_PAGE_RECORD:
                raise RuntimeError("Guest write did not produce a complete sparse NAND page record")
            capture = instance / "capture.wav"
            verify_capture(capture, samples, boundary or 0)
            (output / f"audio-run{index}.wav").write_bytes(capture.read_bytes())
            print(f"PASS run {index}: {FRAMES} exact stereo I2S frames at {RATE} Hz.")
            print(serial.read_text(), end="")
        print("PASS: a fresh QEMU process restored volume 3 from the guest-programmed NAND store.")
        print("PASS: the older single-sector record also restored volume 3.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("qemu", type=Path)
    parser.add_argument("guest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    verify(args.qemu.resolve(strict=True), args.guest.resolve(strict=True), args.output.resolve())
