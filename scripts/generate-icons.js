import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import png2icons from 'png2icons';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.join(__dirname, '..', 'assets');

const srcPng = path.join(assetsDir, 'icon.png'); // master 1024x1024
const outIco = path.join(assetsDir, 'icon.ico');
const outIcns = path.join(assetsDir, 'icon.icns');

if (!fs.existsSync(srcPng)) {
	console.error('❌ Missing assets/icon.png (expected 1024x1024).');
	process.exit(1);
}

const buf = fs.readFileSync(srcPng);

// Windows .ico
{
	const ico = png2icons.createICO(buf, png2icons.BICUBIC, 0, false);
	if (!ico) {
		console.error('❌ Failed to create icon.ico');
		process.exit(1);
	}
	fs.writeFileSync(outIco, ico);
	console.log('✓ Wrote', path.relative(process.cwd(), outIco));
}

// macOS .icns
{
	const icns = png2icons.createICNS(buf, png2icons.BICUBIC, 0, false);
	if (!icns) {
		console.error('❌ Failed to create icon.icns');
		process.exit(1);
	}
	fs.writeFileSync(outIcns, icns);
	console.log('✓ Wrote', path.relative(process.cwd(), outIcns));
}

// Linux PNG set (installers/themes)
const linuxSizes = [512, 256, 128, 64, 48, 32, 24, 16];
await Promise.all(
	linuxSizes.map(async (s) => {
		const out = path.join(assetsDir, `icon-${s}.png`);
		await sharp(buf).resize(s, s).png().toFile(out);
		console.log('✓ Wrote', path.relative(process.cwd(), out));
	})
);

console.log('✅ Icon generation complete.');
