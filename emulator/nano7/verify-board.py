"""Run the bare-metal board smoke test and repeat it after a QMP reset."""
import argparse
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time


EXPECTED = [b"N31_BOOT", b"N31_RAM_OK", b"N31_TIMER_IRQ_OK", b"N31_PASS"]
TIMEOUT = 20


def wait_for(process, condition, description):
    deadline = time.monotonic() + TIMEOUT
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"QEMU exited before {description} ({process.returncode})")
        result = condition()
        if result is not None:
            return result
        time.sleep(0.05)
    raise TimeoutError(f"Timed out waiting for {description}")


def connect_qmp(path):
    connection = socket.socket(socket.AF_UNIX)
    connection.settimeout(TIMEOUT)
    try:
        connection.connect(str(path))
    except (FileNotFoundError, ConnectionRefusedError):
        connection.close()
        return None
    return connection


def command(stream, name):
    stream.write((json.dumps({"execute": name, "id": name}) + "\n").encode())
    stream.flush()
    while line := stream.readline():
        reply = json.loads(line)
        if reply.get("id") != name:
            continue
        if "error" in reply:
            raise RuntimeError(f"{name}: {reply['error']}")
        return
    raise RuntimeError(f"QMP disconnected during {name}")


def serial_output(path, expected):
    output = path.read_bytes() if path.exists() else b""
    if b"N31_FAIL\n" in output:
        raise RuntimeError(f"Guest reported failure: {output!r}")
    if output.splitlines() == expected and output.endswith(b"\n"):
        return output
    return None


def verify(qemu, image, linux_timers):
    expected = EXPECTED.copy()
    machine = "nano7,entry=0x08000000,os-image=guest.bin"
    if linux_timers:
        machine += ",n31-linux-timers=on"
        expected.insert(-1, b"N31_TIMER_E_IRQ7_OK")
    with tempfile.TemporaryDirectory(prefix="nano7-board-") as directory:
        root = Path(directory)
        # Keep user-supplied paths out of QEMU's comma-separated machine options.
        (root / "guest.bin").write_bytes(image.read_bytes())
        serial = root / "serial.log"
        stderr = root / "qemu.log"
        with stderr.open("wb") as log:
            process = subprocess.Popen([
                str(qemu), "-M", machine,
                "-S", "-nodefaults", "-nic", "none", "-display", "none",
                "-serial", "file:serial.log", "-monitor", "none",
                "-qmp", "unix:qmp.sock,server=on,wait=off",
            ], cwd=root, stdout=subprocess.DEVNULL, stderr=log)
            try:
                with wait_for(process, lambda: connect_qmp(root / "qmp.sock"), "QMP") as connection:
                    with connection.makefile("rwb") as stream:
                        if "QMP" not in json.loads(stream.readline()):
                            raise RuntimeError("Invalid QMP greeting")
                        command(stream, "qmp_capabilities")
                        command(stream, "cont")
                        wait_for(process, lambda: serial_output(serial, expected), "first guest pass")
                        print("First launch: RAM, UART3 and timer IRQ checks passed.")
                        command(stream, "system_reset")
                        output = wait_for(
                            process, lambda: serial_output(serial, expected * 2), "post-reset pass",
                        )
                        print("QMP reset: boot state restored and all checks passed again.")
                        print(output.decode(), end="")
                        command(stream, "quit")
                if process.wait(timeout=TIMEOUT) != 0:
                    raise RuntimeError(f"QEMU exited with status {process.returncode}")
            except (OSError, ValueError, RuntimeError):
                print(stderr.read_text(errors="replace"), file=sys.stderr, end="")
                if serial.exists():
                    print(f"Guest serial: {serial.read_bytes()!r}", file=sys.stderr)
                raise
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("qemu", type=Path)
    parser.add_argument("guest", type=Path)
    parser.add_argument("--linux-timers", action="store_true")
    args = parser.parse_args()
    verify(args.qemu.resolve(strict=True), args.guest.resolve(strict=True), args.linux_timers)
