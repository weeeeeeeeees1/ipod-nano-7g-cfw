import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const [kernel, initramfs, qemu = 'qemu-system-arm'] = process.argv.slice(2);
if (!kernel || !initramfs) {
    console.error('Usage: node emulator/smoke.mjs KERNEL INITRAMFS [QEMU]');
    process.exit(2);
}

const emulator = spawn(qemu, [
    '-M', 'virt', '-cpu', 'cortex-a15', '-m', '64M',
    '-display', 'none', '-monitor', 'none', '-serial', 'stdio', '-nic', 'none',
    '-kernel', resolve(kernel), '-initrd', resolve(initramfs),
    '-append', 'console=ttyAMA0 rdinit=/init panic=1',
], { stdio: ['ignore', 'pipe', 'inherit'] });

let tail = '';
let result;
const timeout = setTimeout(() => {
    result = 'Timed out waiting for the BusyBox prompt.';
    emulator.kill();
}, 60_000);
try {
    const code = await new Promise((resolveExit, reject) => {
        emulator.once('error', reject);
        emulator.once('close', resolveExit);
        emulator.stdout.on('data', (chunk) => {
            process.stdout.write(chunk);
            tail = (tail + chunk.toString()).slice(-16_384);
            if (/NANO_SMOKE_PASS\r?\n[\s\S]*\r?\n[^\r\n]*# $/m.test(tail)) {
                result = 'PASS';
                emulator.kill();
            } else if (/NANO_SMOKE_FAIL\r?\n/.test(tail)) {
                result = 'The initramfs WAV check failed.';
                emulator.kill();
            }
        });
    });
    if (result !== 'PASS') throw new Error(result ?? `QEMU stopped (status ${code}).`);
    console.log('\nARM Linux reached a BusyBox prompt and verified the bundled WAV.');
} finally {
    clearTimeout(timeout);
}
