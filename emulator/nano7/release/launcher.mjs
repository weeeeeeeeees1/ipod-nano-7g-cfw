import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createInterface as promptInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const runtime = join(root, 'runtime');
const modes = ['linux', 'display', 'audio', 'check'];

async function modeFromArgs(args) {
    if (args.length === 0 && process.stdin.isTTY) {
        console.log('Nano 7G emulator\n1. Boot N31 Linux\n2. Open the display and controls demo\n3. Capture a test WAV\n4. Run all checks');
        const terminal = promptInterface({ input: process.stdin, output: process.stdout });
        try {
            return modes[Number(await terminal.question('Choose 1–4: ')) - 1];
        } finally {
            terminal.close();
        }
    }
    return args[0] ?? 'check';
}

function openViewer(port) {
    const viewer = process.env.NANO7_VNCVIEWER || join(runtime, 'vncviewer.exe');
    const processHandle = spawn(viewer, [`127.0.0.1::${port}`], {
        stdio: 'ignore',
        detached: true,
    });
    processHandle.once('error', () => {
        console.log(`Connect a VNC viewer to 127.0.0.1::${port}.`);
    });
    processHandle.unref();
}

async function run(mode, options) {
    const display = mode === 'display';
    const port = Number(process.env.NANO7_VNC_PORT ?? 5907);
    if (display && (!Number.isInteger(port) || port < 1024 || port > 65535)) {
        throw new Error('NANO7_VNC_PORT must be an integer between 1024 and 65535.');
    }
    const timeoutSeconds = Number(process.env.NANO7_TIMEOUT_SECONDS ?? 300);
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 2_147_483) {
        throw new Error('NANO7_TIMEOUT_SECONDS must be an integer between 1 and 2147483.');
    }
    const runs = resolve(process.env.NANO7_RUNS ?? join(root, 'runs'));
    await mkdir(runs, { recursive: true });
    const runDir = await mkdtemp(join(runs, `${mode}-`));
    const launcher = spawn(join(runtime, 'qemu-system-x86_64.exe'), [
        '-machine', 'q35', '-accel', 'tcg,thread=multi', '-cpu', 'max', '-smp', '2', '-m', '768',
        '-nodefaults', '-no-reboot', '-display', 'none', '-monitor', 'none', '-serial', 'stdio',
        '-L', join(runtime, 'share'), '-bios', join(runtime, 'share', 'bios-256k.bin'),
        '-kernel', join(runtime, 'vmlinuz'), '-initrd', join(runtime, 'runtime.cpio.gz'),
        '-append', `console=ttyS0 quiet panic=1 nano7.mode=${mode}`,
        '-nic', display ? `user,model=virtio-net-pci,restrict=on,hostfwd=tcp:127.0.0.1:${port}-:5900` : 'none',
    ], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const serial = [];
    const errors = [];
    const wave = [];
    let receivingWave = false;
    let ready = false;
    launcher.stderr.setEncoding('utf8').on('data', data => {
        errors.push(data);
        process.stderr.write(data);
    });
    const lines = createInterface({ input: launcher.stdout, crlfDelay: Infinity });
    lines.on('line', line => {
        if (line === 'NANO7_WAV_BEGIN') {
            receivingWave = true;
        } else if (line === 'NANO7_WAV_END') {
            receivingWave = false;
        } else if (receivingWave) {
            wave.push(line);
        } else {
            serial.push(line);
            console.log(line);
            if (display && line === 'IO READY' && !ready) {
                ready = true;
                clearTimeout(timeout);
                console.log(`VNC display ready at 127.0.0.1::${port}. Press Ctrl+C here to exit.`);
                if (!options.includes('--no-viewer')) openViewer(port);
            }
        }
    });
    let interrupted = false;
    let timedOut = false;
    const cancel = () => {
        interrupted = true;
        launcher.kill();
    };
    const timeout = setTimeout(() => {
        timedOut = true;
        launcher.kill();
    }, timeoutSeconds * 1000);
    process.once('SIGINT', cancel);
    let result;
    try {
        result = await new Promise((done, reject) => {
            launcher.once('error', reject);
            launcher.once('close', done);
        });
    } finally {
        clearTimeout(timeout);
        process.removeListener('SIGINT', cancel);
        await writeFile(join(runDir, 'serial.log'), serial.join('\n') + '\n');
        await writeFile(join(runDir, 'host-qemu.log'), errors.join(''));
    }
    if (timedOut) {
        throw new Error(`The ${mode} run timed out after ${timeoutSeconds} seconds. Logs are in ${runDir}`);
    }
    if (display && interrupted) return;
    if (display && ready) {
        throw new Error(`The display stopped unexpectedly (QEMU exit code: ${result}). Logs are in ${runDir}`);
    }
    if (result !== 0 || !serial.includes(`NANO7_RESULT OK ${mode}`)) {
        throw new Error(`The ${mode} run did not complete. Logs are in ${runDir}`);
    }
    if (mode === 'audio' || mode === 'check') {
        const pcm = Buffer.from(wave.join(''), 'base64');
        if (receivingWave || pcm.length !== 32044 ||
            pcm.toString('ascii', 0, 4) !== 'RIFF' || pcm.readUInt32LE(24) !== 8000) {
            throw new Error(`The guest did not return the expected WAV. Logs are in ${runDir}`);
        }
        const wavPath = join(runDir, 'nano7-output.wav');
        await writeFile(wavPath, pcm);
        console.log(`Captured WAV: ${wavPath}`);
        if (options.includes('--play')) {
            const player = spawnSync('powershell.exe', ['-NoProfile', '-Command',
                '(New-Object System.Media.SoundPlayer $env:NANO7_WAV).PlaySync()'],
            { env: { ...process.env, NANO7_WAV: wavPath }, stdio: 'inherit' });
            if (player.error) throw player.error;
            if (player.status !== 0) throw new Error(`Windows could not play ${wavPath}`);
        }
    }
    console.log(`Logs: ${runDir}`);
}

try {
    const options = process.argv.slice(2);
    const mode = await modeFromArgs(options);
    if (!modes.includes(mode)) {
        console.log('Usage: node launcher.mjs [linux | display | audio | check] [--play | --no-viewer]');
        process.exitCode = mode === 'help' || mode === '--help' ? 0 : 2;
    } else {
        await readFile(join(runtime, 'README-build.txt'));
        await run(mode, options.slice(1));
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
