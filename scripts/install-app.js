import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist', 'app');
const APP_NAME = 'Intrinsic';

function pickPackagedDir(prefix) {
	if (!fs.existsSync(dist)) return null;
	const dirs = fs
		.readdirSync(dist, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);
	return dirs.find((n) => n.startsWith(prefix));
}

function cpDir(src, dest) {
	// fs.cpSync; fall back to manual copy if needed
	fs.rmSync(dest, { recursive: true, force: true });
	fs.cpSync(src, dest, { recursive: true });
}

function ensureDir(p) {
	fs.mkdirSync(p, { recursive: true });
}

function installMac() {
	const d = pickPackagedDir(`${APP_NAME}-darwin-`);
	if (!d) {
		console.error(
			'❌ Packaged .app not found in dist/app/. Run: npm run build'
		);
		process.exit(1);
	}
	const appBundle = path.join(dist, d, `${APP_NAME}.app`);

	// Prefer /Applications; fallback to ~/Applications if no permission
	const sysApps = '/Applications';
	const userApps = path.join(os.homedir(), 'Applications');

	let targetDir = sysApps;
	try {
		fs.accessSync(sysApps, fs.constants.W_OK);
	} catch {
		targetDir = userApps;
		ensureDir(userApps);
	}

	const dest = path.join(targetDir, `${APP_NAME}.app`);
	// Use 'ditto' to preserve bundle metadata/xattrs when available
	try {
		if (process.platform === 'darwin') {
			fs.rmSync(dest, { recursive: true, force: true });
			const res = spawnSync('ditto', ['-rsrcFork', '-v', appBundle, dest], {
				stdio: 'inherit',
			});
			if (res.status !== 0) throw new Error('ditto failed');
		} else {
			cpDir(appBundle, dest);
		}
	} catch (e) {
		console.warn(
			'ditto failed, falling back to recursive copy:',
			e?.message || e
		);
		cpDir(appBundle, dest);
	}

	console.log(`✅ Installed ${APP_NAME}.app to: ${dest}`);
}

function installWindows() {
	const d = pickPackagedDir(`${APP_NAME}-win32-`);
	if (!d) {
		console.error(
			'❌ Packaged folder not found in dist/app/. Run: npm run build'
		);
		process.exit(1);
	}
	const packagedDir = path.join(dist, d); // contains Intrinsic.exe etc.

	// User-scope install location (no admin): %LOCALAPPDATA%\Programs\Intrinsic
	const programsDir = path.join(
		process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
		'Programs',
		APP_NAME
	);
	ensureDir(path.dirname(programsDir));
	cpDir(packagedDir, programsDir);
	console.log(`✅ Installed to: ${programsDir}`);

	// Create Start Menu shortcut: %AppData%\Microsoft\Windows\Start Menu\Programs\Intrinsic.lnk
	const startMenuDir = path.join(
		process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
		'Microsoft',
		'Windows',
		'Start Menu',
		'Programs'
	);
	ensureDir(startMenuDir);
	const exe = path.join(programsDir, `${APP_NAME}.exe`);
	const lnk = path.join(startMenuDir, `${APP_NAME}.lnk`);
	const ps = `
    $WshShell = New-Object -ComObject WScript.Shell;
    $Shortcut = $WshShell.CreateShortcut("${lnk.replace(/\\/g, '\\\\')}");
    $Shortcut.TargetPath = "${exe.replace(/\\/g, '\\\\')}";
    $Shortcut.IconLocation = "${exe.replace(/\\/g, '\\\\')},0";
    $Shortcut.WorkingDirectory = "${programsDir.replace(/\\/g, '\\\\')}";
    $Shortcut.Save();
  `;
	const res = spawnSync(
		'powershell.exe',
		['-NoProfile', '-NonInteractive', '-Command', ps],
		{ stdio: 'inherit' }
	);
	if (res.status !== 0) {
		console.warn(
			'⚠️  Failed to create Start Menu shortcut. You can pin the app manually.'
		);
	} else {
		console.log(`✅ Created Start Menu shortcut: ${lnk}`);
	}

	console.log('ℹ️ Tip: right-click the app and choose “Pin to Start/Taskbar”.');
}

function installLinux() {
	const d = pickPackagedDir(`${APP_NAME}-linux-`);
	if (!d) {
		console.error(
			'❌ Packaged folder not found in dist/app/. Run: npm run build'
		);
		process.exit(1);
	}
	const packagedDir = path.join(dist, d); // contains Intrinsic binary & resources
	const installDir = path.join(os.homedir(), '.local', 'share', APP_NAME);
	ensureDir(installDir);
	cpDir(packagedDir, installDir);
	console.log(`✅ Installed to: ${installDir}`);

	// Icon -> user icon theme
	let iconRef = 'utilities-terminal';
	const icon512 = path.join(root, 'assets', 'icon-512.png');
	const iconSrc = fs.existsSync(icon512)
		? icon512
		: path.join(root, 'assets', 'icon.png');

	if (fs.existsSync(iconSrc)) {
		const iconDestDir = path.join(
			os.homedir(),
			'.local',
			'share',
			'icons',
			'hicolor',
			'512x512',
			'apps'
		);
		ensureDir(iconDestDir);
		const destPng = path.join(iconDestDir, `${APP_NAME.toLowerCase()}.png`);
		try {
			fs.copyFileSync(iconSrc, destPng);
			iconRef = APP_NAME.toLowerCase();
		} catch {}
	}

	// .desktop entry
	const desktopDir = path.join(os.homedir(), '.local', 'share', 'applications');
	ensureDir(desktopDir);
	const desktopFile = path.join(desktopDir, `${APP_NAME}.desktop`);
	const execPath = path.join(installDir, APP_NAME); // packaged binary name
	const contents = `[Desktop Entry]
Type=Application
Name=${APP_NAME}
Comment=${APP_NAME}
Exec="${execPath}"
Icon=${iconRef}
Terminal=false
Categories=Utility;Productivity;
`;
	fs.writeFileSync(desktopFile, contents, { mode: 0o644 });
	// Best-effort cache refresh
	try {
		spawnSync('update-desktop-database');
	} catch {}
	console.log(`✅ Installed launcher: ${desktopFile}`);
	console.log('ℹ️ The app should now appear in your application launcher.');
}

(function main() {
	if (process.platform === 'darwin') return installMac();
	if (process.platform === 'win32') return installWindows();
	return installLinux();
})();
