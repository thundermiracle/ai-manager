import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconPath = resolve(__dirname, "../src-tauri/icons/icon.png");

if (existsSync(iconPath)) process.exit(0);

const width = 512;
const height = 512;

function crc32(buf) {
	let crc = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		crc ^= buf[i];
		for (let j = 0; j < 8; j++) {
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const typeAndData = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(typeAndData));
	return Buffer.concat([len, typeAndData, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const rawData = Buffer.alloc(height * (1 + width * 4));
for (let y = 0; y < height; y++) {
	const rowOffset = y * (1 + width * 4);
	rawData[rowOffset] = 0; // filter byte: none
	for (let x = 0; x < width; x++) {
		const px = rowOffset + 1 + x * 4;
		rawData[px] = 66; // R
		rawData[px + 1] = 133; // G
		rawData[px + 2] = 244; // B
		rawData[px + 3] = 255; // A
	}
}

const png = Buffer.concat([
	signature,
	pngChunk("IHDR", ihdr),
	pngChunk("IDAT", deflateSync(rawData)),
	pngChunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(iconPath), { recursive: true });
writeFileSync(iconPath, png);
