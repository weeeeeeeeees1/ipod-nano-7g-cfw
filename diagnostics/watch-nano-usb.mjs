import { execFile } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers/promises';
import { parseArgs, promisify } from 'node:util';

const usage = 'Usage: node diagnostics/watch-nano-usb.mjs [seconds] [--model MODEL] [--firmware VERSION]';
let options;
try {
    options = parseArgs({
        allowPositionals: true,
        options: {
            help: { type: 'boolean', short: 'h' },
            model: { type: 'string' },
            firmware: { type: 'string' },
        },
    });
} catch (error) {
    console.error(error.message);
    console.error(usage);
    process.exit(2);
}
const seconds = Number(options.positionals[0] ?? 0);
if (options.values.help) {
    console.log(usage);
    console.log('Omit seconds for a snapshot. Use 1–3600 to watch for USB changes.');
    console.log('Model and firmware are optional values transcribed from the iPod About screen.');
    process.exit(0);
}
if (options.positionals.length > 1 || !Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
    console.error(usage);
    process.exit(2);
}
const reportedDevice = Object.fromEntries(
    ['model', 'firmware'].flatMap(field => {
        const value = options.values[field]?.trim();
        return value ? [[field, value]] : [];
    }),
);
if (Object.values(reportedDevice).some(value => value.length > 80 || /[\x00-\x1f\x7f]/.test(value))) {
    console.error('Use a single line up to 80 characters for each About value.');
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
            appleDfuIdSeen: ids.includes('05AC:1234'),
            ...(Object.keys(reportedDevice).length ? { reportedDevice } : {}),
        }));
        previous = current;
    }
    if (performance.now() + 200 >= deadline) break;
    await setTimeout(200);
} while (performance.now() < deadline);
