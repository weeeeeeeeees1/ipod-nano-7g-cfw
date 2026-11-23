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
