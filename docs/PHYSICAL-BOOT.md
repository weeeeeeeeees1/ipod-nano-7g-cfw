# Physical Nano boot evidence

## Record the device first

Record the model and firmware exactly as displayed in About, the
host OS, how the Nano is powered, and the initial screen and USB state.
Use the [read-only USB checker](DFU_NOTES.md) on Windows. An About entry
and a USB observation are separate pieces of evidence. Omit the device
serial number and Windows device instance paths from public reports.

## Record the loader and payload

A physical boot attempt requires a documented loader for the reported
model and firmware. Record its source URL, version, binary SHA-256,
supported entry procedure, expected output channel, and whether it
uses RAM only. Verify the [N31 payload hashes](../hardware/n31/SHA256SUMS.txt)
and record which format was delivered. Record stock restore readiness
before considering any persistent operation.

## Capture execution

1. Save the first device-side loader banner or equivalent identifying
   output. Record USB transitions separately.
2. Save the continuous device-side output through the handoff into Linux.
   Include the kernel version, the N31 board identification, and
   `NANO_SMOKE_PASS` followed by the BusyBox prompt if reached.
3. If execution stops, save the last device-side line and the corresponding
   host result. Record the output channel and whether the device returned
   to its original boot state.

A USB product ID confirms enumeration. A loader banner confirms loader
execution. A device-side kernel banner confirms Linux started, and the
BusyBox prompt confirms userspace. Keep the physical milestone pending
when the only evidence is emulator output or USB enumeration.

## Report template

- Device model and About firmware
- Installed build if independently observed, with evidence
- Host OS, power source, initial screen, and USB observations
- Loader source, version, SHA-256, prerequisites, and entry procedure
- Payload format and SHA-256
- Output channel, raw device log, and last confirmed stage
- Final device state and whether anything was written persistently
