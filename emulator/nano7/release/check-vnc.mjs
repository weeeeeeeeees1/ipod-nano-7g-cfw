import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.NANO7_VNC_PORT ?? 5907);
const socket = connect(port, '127.0.0.1');
socket.setTimeout(5000, () => socket.destroy(new Error('VNC timed out')));
const stream = socket[Symbol.asyncIterator]();
let buffered = Buffer.alloc(0);

async function receive(size) {
    while (buffered.length < size) {
        const chunk = await stream.next();
        if (chunk.done) throw new Error('The VNC connection closed');
        buffered = Buffer.concat([buffered, chunk.value]);
    }
    const result = buffered.subarray(0, size);
    buffered = buffered.subarray(size);
    return result;
}

function sendPointer(button, x, y) {
    const message = Buffer.from([5, button, 0, 0, 0, 0]);
    message.writeUInt16BE(x, 2);
    message.writeUInt16BE(y, 4);
    socket.write(message);
}

try {
    const version = await receive(12);
    if (version.toString() !== 'RFB 003.008\n') throw new Error('Unexpected VNC version');
    socket.write(version);
    const numberOfTypes = (await receive(1))[0];
    if (!(await receive(numberOfTypes)).includes(1)) throw new Error('Loopback VNC unavailable');
    socket.write(Buffer.from([1]));
    if ((await receive(4)).readUInt32BE() !== 0) throw new Error('VNC authentication failed');
    socket.write(Buffer.from([1]));
    const header = await receive(24);
    const width = header.readUInt16BE(0);
    const height = header.readUInt16BE(2);
    if (width !== 240 || height !== 432) throw new Error(`Unexpected VNC dimensions ${width} × ${height}`);
    await receive(header.readUInt32BE(20));

    // Little-endian true color pixels, with 8 bits per color.
    socket.write(Buffer.from([0, 0, 0, 0, 32, 24, 0, 1, 0, 255, 0, 255, 0, 255, 16, 8, 0, 0, 0, 0]));
    socket.write(Buffer.from([2, 0, 0, 1, 0, 0, 0, 0])); // Raw rectangles.
    const request = Buffer.from([3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    request.writeUInt16BE(width, 6);
    request.writeUInt16BE(height, 8);
    socket.write(request);
    const update = await receive(4);
    if (update[0] !== 0) throw new Error('Expected a framebuffer update');
    const surface = Buffer.alloc(width * height * 4);
    for (let i = 0; i < update.readUInt16BE(2); i++) {
        const rectangle = await receive(12);
        const x = rectangle.readUInt16BE(0);
        const y = rectangle.readUInt16BE(2);
        const w = rectangle.readUInt16BE(4);
        const h = rectangle.readUInt16BE(6);
        if (rectangle.readInt32BE(8) !== 0 || x + w > width || y + h > height) {
            throw new Error('Unexpected VNC rectangle');
        }
        for (let row = 0; row < h; row++) {
            (await receive(w * 4)).copy(surface, ((y + row) * width + x) * 4);
        }
    }
    for (const [x, y, rgb] of [[0, 0, 0xff0000], [239, 0, 0x00ff00],
        [0, 431, 0x0000ff], [239, 431, 0xffff00], [30, 54, 0xffffff], [199, 377, 0xffffff]]) {
        if ((surface.readUInt32LE(4 * (y * width + x)) & 0xffffff) !== rgb) {
            throw new Error(`Unexpected VNC pixel at (${x}, ${y})`);
        }
    }
    console.log('PASS: Windows received the 240 × 432 test frame over loopback VNC.');

    sendPointer(0, 30, 54);
    await delay(250);
    sendPointer(1, 30, 54);
    await delay(250);
    sendPointer(1, 199, 377);
    await delay(250);
    sendPointer(0, 199, 377);
    socket.write(Buffer.from([4, 1, 0, 0, 0, 0, 0, 0x68]));
    await delay(300);
    socket.write(Buffer.from([4, 0, 0, 0, 0, 0, 0, 0x68]));
    await delay(350);
    console.log('Sent touch press, drag, release and Home. Check the guest serial log for its receipts.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    socket.destroy();
}
