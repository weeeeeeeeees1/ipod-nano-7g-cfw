import { readFileSync, writeFileSync } from 'node:fs';

// Minimal ISO9660 image for cloud-init NoCloud. All content fits one sector
// per file and uses identifiers Linux exposes verbatim.
const block = 2048;
const publicKey = readFileSync(process.argv[2], 'utf8').trim();
const files = [
    ['meta-data', Buffer.from('instance-id: nano7-phase1\nlocal-hostname: nano7-build\n')],
    ['user-data', Buffer.from(`#cloud-config
ssh_pwauth: false
disable_root: true
ssh_authorized_keys:
  - ${publicKey}
`)],
];
const image = Buffer.alloc((21 + files.length) * block);
function both16(buffer, offset, value) {
    buffer.writeUInt16LE(value, offset);
    buffer.writeUInt16BE(value, offset + 2);
}
function both32(buffer, offset, value) {
    buffer.writeUInt32LE(value, offset);
    buffer.writeUInt32BE(value, offset + 4);
}
function record(name, extent, bytes, directory = false) {
    const id = typeof name === 'number' ? Buffer.from([name]) : Buffer.from(name);
    const result = Buffer.alloc(33 + id.length + Number(id.length % 2 === 0));
    result[0] = result.length;
    both32(result, 2, extent);
    both32(result, 10, bytes);
    result.set([126, 11, 23, 0, 0, 0, 0], 18);
    result[25] = directory ? 2 : 0;
    both16(result, 28, 1);
    result[32] = id.length;
    id.copy(result, 33);
    return result;
}
const primary = image.subarray(16 * block, 17 * block);
primary[0] = 1;
primary.write('CD001', 1);
primary[6] = 1;
primary.write('CIDATA'.padEnd(32), 40);
both32(primary, 80, image.length / block);
both16(primary, 120, 1);
both16(primary, 124, 1);
both16(primary, 128, block);
both32(primary, 132, 10);
primary.writeUInt32LE(18, 140);
primary.writeUInt32BE(19, 148);
record(0, 20, block, true).copy(primary, 156);
primary[881] = 1;
image[17 * block] = 255;
image.write('CD001', 17 * block + 1);
image[17 * block + 6] = 1;
for (const [sector, order] of [[18, 'LE'], [19, 'BE']]) {
    const table = image.subarray(sector * block);
    table[0] = 1;
    table['writeUInt32' + order](20, 2);
    table['writeUInt16' + order](1, 6);
}
const entries = [record(0, 20, block, true), record(1, 20, block, true)];
files.forEach(([name, content], index) => {
    entries.push(record(name, 21 + index, content.length));
    content.copy(image, (21 + index) * block);
});
Buffer.concat(entries).copy(image, 20 * block);
writeFileSync(process.argv[3], image);
