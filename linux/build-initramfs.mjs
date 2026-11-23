import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

function archive(entries) {
    let inode = 0;
    const pad = (length) => Buffer.alloc((4 - length % 4) % 4);
    return Buffer.concat([...entries, ['TRAILER!!!', 0, Buffer.alloc(0)]].flatMap(
        ([path, mode, data, deviceMajor = 0, deviceMinor = 0]) => {
            const name = Buffer.from(path + '\0');
            const fields = [
                ++inode, mode, 0, 0, 1, 0, data.length,
                0, 0, deviceMajor, deviceMinor, name.length, 0,
            ];
            const header = Buffer.from('070701' + fields.map(
                (value) => value.toString(16).padStart(8, '0'),
            ).join(''));
            return [header, name, pad(header.length + name.length), data, pad(data.length)];
        },
    ));
}

function testTone() {
    const sampleRate = 8000;
    const samples = 2000;
    const wav = Buffer.alloc(44 + 2 * samples);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(samples * 2, 40);
    for (let sample = 0; sample < samples; sample++) {
        const envelope = Math.min(sample / 80, (samples - 1 - sample) / 80, 1);
        const value = Math.sin(2 * Math.PI * 440 * sample / sampleRate) * envelope;
        wav.writeInt16LE(Math.round(value * 8000), 44 + 2 * sample);
    }
    return wav;
}

const init = Buffer.from(`#!/bin/busybox sh
set -eu
busybox=/bin/busybox
if [ "$($busybox dd if=/nano-test.wav bs=1 count=4 2>/dev/null)" = RIFF ] &&
   [ "$($busybox dd if=/nano-test.wav bs=1 skip=8 count=4 2>/dev/null)" = WAVE ] &&
   [ "$($busybox wc -c </nano-test.wav)" -eq 4044 ]; then
    echo NANO_SMOKE_PASS
else
    echo NANO_SMOKE_FAIL
fi
exec /bin/busybox sh
`);

const [busyboxPath, outputPath] = process.argv.slice(2);
if (!busyboxPath || !outputPath) {
    console.error('Usage: node linux/build-initramfs.mjs STATIC_ARMV7_BUSYBOX OUTPUT.cpio.gz');
    process.exit(2);
}
const busybox = await readFile(busyboxPath);
if (busybox.length < 52 || busybox.readUInt32BE(0) !== 0x7f454c46 ||
    busybox[4] !== 1 || busybox[5] !== 1 || busybox.readUInt16LE(18) !== 40) {
    throw new Error('BusyBox must be a 32-bit little-endian ARM ELF executable.');
}
const programOffset = busybox.readUInt32LE(28);
const entrySize = busybox.readUInt16LE(42);
const entryCount = busybox.readUInt16LE(44);
if (entrySize < 32 || !entryCount || programOffset + entrySize * entryCount > busybox.length) {
    throw new Error('Invalid BusyBox ELF program headers.');
}
for (let index = 0; index < entryCount; index++) {
    if (busybox.readUInt32LE(programOffset + index * entrySize) === 3) {
        throw new Error('BusyBox requires a loader. Supply a statically linked binary.');
    }
}

const empty = Buffer.alloc(0);
const data = archive([
    ['bin', 0o040755, empty],
    ['dev', 0o040755, empty],
    ['dev/console', 0o020600, empty, 5, 1],
    ['bin/busybox', 0o100755, busybox],
    ['init', 0o100755, init],
    ['nano-test.wav', 0o100644, testTone()],
]);
await writeFile(outputPath, gzipSync(data), { flag: 'wx' });
