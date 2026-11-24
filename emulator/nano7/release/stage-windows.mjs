import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [qemu, debian, nodeRuntime, output, viewer] = process.argv.slice(2);
if (!qemu || !debian || !nodeRuntime || !output) {
    console.error('Usage: node stage-windows.mjs QEMU_DIR DEBIAN_RUNTIME NODE_DIR OUTPUT [VNC_VIEWER]');
    process.exit(2);
}
const source = fileURLToPath(new URL('.', import.meta.url));
const destination = resolve(output);
const runtime = join(destination, 'runtime');
await mkdir(runtime, { recursive: true });
await mkdir(join(runtime, 'share'));
await copyFile(join(nodeRuntime, 'node.exe'), join(runtime, 'node.exe'));
await copyFile(join(nodeRuntime, 'LICENSE'), join(runtime, 'Node-LICENSE.txt'));

for (const file of ['launcher.mjs', 'Start-Nano7.cmd', 'README.md', 'check-vnc.mjs']) {
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
