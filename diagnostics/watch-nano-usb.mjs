import { execFile } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers/promises';
import { promisify } from 'node:util';

const seconds = Number(process.argv[2] ?? 0);
if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
    console.error('Usage: node diagnostics/watch-nano-usb.mjs [seconds from 0 to 3600]');
    process.exit(2);
}
if (process.platform !== 'win32') {
    console.error('This USB diagnostic requires Windows PnPUtil.');
    process.exit(2);
}

const enumerate = promisify(execFile);
const deadline = performance.now() + seconds * 1000;
let previous;
do {
    const { stdout } = await enumerate('pnputil.exe', ['/enum-devices', '/connected'], {
        windowsHide: true,
        timeout: 10_000,
    });
    const matches = stdout.matchAll(/^\s*[^:\r\n]+:\s*USB\\VID_05AC&PID_([\dA-F]{4})\\/gim);
    const ids = [...new Set(Array.from(matches, ([, id]) => '05AC:' + id.toUpperCase()))].sort();
    const current = ids.join(',');
    if (current !== previous) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            appleUsbIds: ids,
            nanoNormalMode: ids.includes('05AC:1267'),
        }));
        previous = current;
    }
    if (performance.now() + 200 >= deadline) break;
    await setTimeout(200);
} while (performance.now() < deadline);
