import fsp from 'fs/promises';
import path from 'path';
import { getUserData } from './user-data.js';

/**
    Writes content to a specified file within userData directories.
    Creates directories if they do not exist.

    Saves different pipeline steps in orderly manner for later review or debugging.
    Helps see what worked and what didn't (specially the cleaner) and refine accordingly.
 */
export async function fileWriter(filename, content, isRaw = false) {
	const userData = getUserData(); // read from userData

	if (
		!userData.filewriter_abs_path ||
		userData.filewriter_abs_path.trim() === ''
	) {
		return false;
	}

	try {
		await fsp.mkdir(userData.filewriter_abs_path, { recursive: true });

		let targetPath;
		if (isRaw) {
			if (
				userData.filewriter_raw_abs_path &&
				userData.filewriter_raw_abs_path.trim() !== ''
			) {
				await fsp.mkdir(userData.filewriter_raw_abs_path, { recursive: true });
				targetPath = path.join(
					userData.filewriter_raw_abs_path,
					`${filename}.txt`
				);
			} else {
				targetPath = path.join(userData.filewriter_abs_path, `raw_parsed.txt`);
			}
		} else {
			targetPath = path.join(userData.filewriter_abs_path, `${filename}.txt`);
		}

		await fsp.writeFile(targetPath, content, 'utf8');
		return true;
	} catch (err) {
		console.error('fileWriter failed to write file:', err);
		return false;
	}
}
