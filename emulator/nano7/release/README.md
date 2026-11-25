# Nano 7G emulator for Windows

Extract the whole archive to a writable folder on Windows x64.
Double-click `Start-Nano7.cmd` for the menu or open that folder in a
terminal. The archive includes Node.js and the emulator runtime.

```cmd
Start-Nano7.cmd linux
Start-Nano7.cmd display
Start-Nano7.cmd audio --play
Start-Nano7.cmd check
```

- **Linux** boots the N31 kernel with 64 MiB of emulated RAM, checks the
  fixture in BusyBox, and exits after the serial prompt. UART3 supports
  transmit only in this build.
- **Display** opens the standalone VNC viewer when it is bundled. Click
  or drag the test pattern to send touch input. Use **H** for Home,
  **P** for the Power button, **Space** for Play/Pause, and the **arrow
  keys** for volume. **F7** rotates the console. The firmware-free guest
  reports the input events in the launcher terminal. Press **Ctrl+C** in
  that terminal to exit. When using your own viewer, connect to
  `127.0.0.1::5907`. Set `NANO7_VNC_PORT` to use a different loopback port.
- **Audio** tests pause, resume, volume and persistence, then saves the
  captured WAV. The optional `--play` switch plays it through Windows
  after verification.
- **Check** runs the Linux, automated display and controls, and audio
  checks. It takes longer under software emulation.

Each launch saves logs in its own subfolder under `runs`. The display
demo and the WAV tests use separate open-source guests. The release
contains a small Linux runtime and uses software emulation on Windows.
It requires no connected iPod or DFU. Stock RetailOS boot and installing
software on a physical Nano are outside this release's coverage.

## Troubleshooting

- If the window closes before you can read it, open PowerShell in the
  extracted folder and run `.\Start-Nano7.cmd check`.
- On a slow host, set `$env:NANO7_TIMEOUT_SECONDS = '600'` in PowerShell
  before launching. The default is 300 seconds. Display mode applies
  the timeout until it is ready.
- If the viewer does not open, connect to the loopback address printed by
  the launcher. For a port conflict, set `$env:NANO7_VNC_PORT = '5910'`.
- On failure, inspect `serial.log` and `host-qemu.log` in the run folder.

See the [build and packaging guide](BUILD.md) for source builds.
