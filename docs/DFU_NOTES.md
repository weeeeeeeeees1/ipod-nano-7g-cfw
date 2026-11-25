# Nano 7G USB notes

On November 23, 2026, Windows reported the connected device as **Apple iPod**
at **05AC:1267** with a USB Mass Storage interface. **05AC:110B** was the
EarPods. This confirms a normal USB data connection. The battery hypothesis
and the exact firmware build on the connected unit remain unverified.

From the repository root on Windows with Node.js installed:

```powershell
node diagnostics/watch-nano-usb.mjs
node diagnostics/watch-nano-usb.mjs 30
```

The first command takes a snapshot. The second emits one JSON record for each
change in the set of Apple USB product IDs observed over 30 seconds. It
reports product IDs without serial numbers and does not send commands to the
iPod. Sampling can miss a connection that appears and disappears between
queries. The observed normal-mode output included `nanoNormalMode: true`.

## Collect a report

Copy the values from the iPod About screen. For example, in PowerShell:

```powershell
node diagnostics/watch-nano-usb.mjs 30 --model MD477LL --firmware "1.1.2 PC" |
    Set-Content -Encoding utf8 nano7-usb.jsonl
```

Replace the example values with what your unit shows. The checker reports
these values under `reportedDevice` as user-entered observations. It
does not read the installed firmware.

`nanoNormalMode` means the observed IDs included `05AC:1267`. That ID
alone cannot distinguish the stock UI from Disk Mode. `appleDfuIdSeen`
means the observed IDs included `05AC:1234`. It is an Apple DFU identity
and the checker cannot associate it with a particular connected device.
Record the device's screen state separately. USB observations do not
demonstrate code execution.

See the [physical boot evidence guide](PHYSICAL-BOOT.md) for how to attach
the log and record loader and Linux output.
