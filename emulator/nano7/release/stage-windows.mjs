import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [qemu, debian, nodeRuntime, output, viewer] = process.argv.slice(2);
if (!qemu || !debian || !nodeRuntime || !output) {
    console.error('Usage: node stage-windows.mjs QEMU_DIR DEBIAN_RUNTIME NODE_DIR OUTPUT [VNC_VIEWER]');
    process.exit(2);
}
const source = fileURLToPath(new URL('.', import.meta.url));
const destination = resolve(output);
const runtime = join(destination, 'runtime');
await mkdir(destination);
await mkdir(runtime);
await mkdir(join(runtime, 'share'));
await copyFile(join(nodeRuntime, 'node.exe'), join(runtime, 'node.exe'));
await copyFile(join(nodeRuntime, 'LICENSE'), join(runtime, 'Node-LICENSE.txt'));

for (const file of ['launcher.mjs', 'Start-Nano7.cmd', 'README.md', 'BUILD.md', 'check-vnc.mjs']) {
    await copyFile(join(source, file), join(destination, file));
}
for (const file of ['qemu-system-x86_64.exe', 'COPYING', 'COPYING.LIB',
    ...(await readdir(qemu)).filter(name => name.endsWith('.dll'))]) {
    await copyFile(join(qemu, file), join(runtime, file));
}
for (const file of ['bios-256k.bin', 'linuxboot_dma.bin', 'kvmvapic.bin', 'efi-virtio.rom']) {
    await copyFile(join(qemu, 'share', file), join(runtime, 'share', file));
}
for (const file of ['vmlinuz', 'runtime.cpio.gz', 'README-build.txt']) {
    await copyFile(join(debian, file), join(runtime, file));
}
if (viewer) await copyFile(viewer, join(runtime, 'vncviewer.exe'));

const hashes = [];
for (const file of (await readdir(destination, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => relative(destination, join(entry.parentPath, entry.name)).replaceAll(sep, '/'))
    .sort()) {
    const digest = createHash('sha256');
    for await (const chunk of createReadStream(join(destination, file))) digest.update(chunk);
    hashes.push(`${digest.digest('hex')}  ${file}`);
}
await writeFile(join(destination, 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
