"""QMP helpers for NanoEmu headless tests."""
import json
import socket
import time

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


def command(stream, name, arguments=None):
    request = {"execute": name, "id": name}
    if arguments is not None:
        request["arguments"] = arguments
    stream.write((json.dumps(request) + "\n").encode())
    stream.flush()
    while line := stream.readline():
        reply = json.loads(line)
        if reply.get("id") != name:
            continue
        if "error" in reply:
            raise RuntimeError(f"{name}: {reply['error']}")
        return
    raise RuntimeError(f"QMP disconnected during {name}")
