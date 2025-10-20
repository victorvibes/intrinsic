import { execSync } from 'node:child_process';
import packager from 'electron-packager';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('> Building renderer with Vite...');
execSync('vite build', { stdio: 'inherit' });

console.log('> Generating icons (.ico/.icns) ...');
execSync(`node "${path.join(__dirname, 'generate-icons.js')}"`, {
	stdio: 'inherit',
});

const OUT_DIR = path.join(__dirname, '..', 'dist', 'app');
fs.mkdirSync(OUT_DIR, { recursive: true });

const platform = process.platform;
const arch = process.arch;
const name = 'Intrinsic';
const iconPath = {
	darwin: 'assets/icon.icns',
	win32: 'assets/icon.ico',
	linux: 'assets/icon.png',
}[platform];

const licenseSrc = path.join(__dirname, '..', 'LICENSE');
const licenseTmp = path.join(__dirname, '..', 'assets', 'LICENSE.intrinsic');
try {
	fs.copyFileSync(licenseSrc, licenseTmp);
} catch {}

const opts = {
	dir: '.',
	name,
	overwrite: true,
	prune: true,
	out: OUT_DIR,
	platform,
	arch,
	appVersion: process.env.npm_package_version,
	icon: path.join(__dirname, '..', iconPath),
	appBundleId: 'com.genbraham.intrinsic',
	ignore: [
		/^\/\.git/,
		/^\/\.github/,
		/^\/dist\/app/,
		/^\/scripts/,
		/^\/config\.json$/,
		/^\/config\.template\.json$/,
		/^\/README\.md$/,
		/^\/LICENSE$/,
		/^\/vite\.config\.js$/,
		/^\/package-lock\.json$/,
		/^\/test/,
	],
};

if (platform === 'darwin') {
	const extendInfo = path.join(__dirname, '..', 'assets', 'extend-info.plist');
	if (fs.existsSync(extendInfo)) opts.extendInfo = extendInfo;
	opts.appCategoryType = 'public.app-category.productivity';
}

console.log(`> Packaging for ${platform}-${arch}...`);
const appPaths = await packager(opts);

for (const appPath of appPaths) {
	// Candidates: the path itself and its parent.
	const candidates = [appPath, path.dirname(appPath)];

	let licenseRoot = null;
	for (const dir of candidates) {
		if (
			fs.existsSync(path.join(dir, 'LICENSE')) ||
			fs.existsSync(path.join(dir, 'LICENSES.chromium.html'))
		) {
			licenseRoot = dir;
			break;
		}
	}

	licenseRoot = licenseRoot || appPath;

	try {
		const src = path.join(__dirname, '..', 'LICENSE');
		const dst = path.join(licenseRoot, 'LICENSE.intrinsic');
		fs.copyFileSync(src, dst);
	} catch {}
}

try {
	fs.rmSync(licenseTmp, { force: true });
} catch {}

try {
	console.log('> Setting CLI permissions...');
	const cliPath = path.join(__dirname, '..', 'scripts', 'cli.js');
	fs.chmodSync(cliPath, 0o755);
} catch (e) {
	console.warn('Could not chmod CLI:', e?.message || e);
}

try {
	console.log('> Installing app to system location…');
	execSync(`node "${path.join(__dirname, 'install-app.js')}"`, {
		stdio: 'inherit',
	});
} catch (e) {
	console.warn('Could not install app to system location:', e?.message || e);
}

console.log('✅ Build complete!\nApp bundles created at:');
for (const p of appPaths) console.log('  →', p);
