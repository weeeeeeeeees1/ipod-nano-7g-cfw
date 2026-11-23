import json
import subprocess
import sys
import tempfile


def verify(binary):
    with tempfile.TemporaryDirectory(prefix="nano7-verify-") as directory:
        completed = subprocess.run(
            [
                binary, "-M", "nano7", "-S", "-nodefaults", "-nic", "none",
                "-display", "none", "-serial", "none", "-monitor", "none",
                "-qmp", "stdio",
            ],
            cwd=directory,
            input="\n".join(json.dumps(command) for command in [
                {"execute": "qmp_capabilities", "id": "capabilities"},
                {"execute": "query-machines", "id": "machines"},
                {"execute": "query-status", "id": "status"},
                {"execute": "query-cpus-fast", "id": "cpus"},
                {"execute": "quit", "id": "quit"},
            ]) + "\n",
            capture_output=True,
            text=True,
            timeout=20,
        )
    if completed.stderr:
        print(completed.stderr, file=sys.stderr, end="")
    completed.check_returncode()
    responses = {
        message["id"]: message
        for line in completed.stdout.splitlines()
        if "id" in (message := json.loads(line))
    }
    expected = ("capabilities", "machines", "status", "cpus", "quit")
    if any("return" not in responses.get(key, {}) for key in expected):
        raise RuntimeError(f"Missing or failed QMP response: {completed.stdout}")
    machines = responses["machines"]["return"]
    if not any(machine["name"] == "nano7" for machine in machines):
        raise RuntimeError("QEMU did not register nano7.")
    status = responses["status"]["return"]
    cpus = responses["cpus"]["return"]
    if status["running"] or status["status"] not in {"prelaunch", "paused"} or len(cpus) != 1:
        raise RuntimeError(f"Unexpected launch state: {status}, {cpus}")
    print(f"PASS: nano7 registered; headless state={status['status']}; CPUs={len(cpus)}.")


if __name__ == "__main__":
    from pathlib import Path

    if len(sys.argv) != 2:
        sys.exit("Usage: python3 verify-nano7.py /path/to/qemu-system-arm")
    verify(str(Path(sys.argv[1]).resolve(strict=True)))
