# Contributing

For an emulator issue, include the release version or commit, Windows version
and architecture, launch mode, and reproduction steps. Attach the relevant
`serial.log` and `host-qemu.log` from the run folder under `runs`.
Redact personal paths and identifiers. Include your CPU and elapsed time for timeout reports.

For emulator changes, start with the [NanoEmu build](emulator/nano7/README.md)
and run the relevant board or Linux verifier. For Windows packaging changes,
also run `Start-Nano7.cmd check` from a fresh extraction and report the result.
Include commands and results in your pull request.

For hardware observations, include the Nano model, firmware as displayed,
and what the screen or host reported. Keep Apple firmware images, device serial
numbers, generated binaries, and local disk images out of pull requests.
