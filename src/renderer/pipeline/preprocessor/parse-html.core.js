export function processHTMLTextCore(text, startPage, endPage) {
	if (!text) return '';
	return processContent(text, startPage, endPage);
}

//  process HTML content to extract readable text
function processContent(content, startPage, endPage) {
	if (!content) return '';

	// normalize input
	content = content.replace(/\sstyle\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '');
	content = content.replace(/<style[\s\S]*?<\/style>/gi, '');

	const parser = new DOMParser();
	const doc = parser.parseFromString(content, 'text/html');

	// clean DOM
	removeSkippableTags(doc);

	// detect page-like containers
	const pageDivs = doc.querySelectorAll('.pageView');

	if (pageDivs.length > 0) {
		let pages = [];

		pageDivs.forEach((div) => {
			let text = extractFormattedText(div, false, false, false);
			text = postprocessing(text);
			pages.push(text.trim());
		});

		// page range filtering
		const strToInt = (value) => {
			if (value === undefined || value === null || value === '') return null;
			const str = String(value).trim();
			const trimmed = str.replace(/^0+/, '');
			if (!trimmed || trimmed.length > 4 || !/^\d+$/.test(trimmed)) return null;
			const val = parseInt(trimmed, 10);
			return val > 0 ? val : null;
		};

		const minPageInt = strToInt(startPage);
		const maxPageInt = strToInt(endPage);

		let startIdx = 0;
		let endIdx = pages.length;

		if (minPageInt && maxPageInt) {
			if (maxPageInt >= minPageInt) {
				startIdx = minPageInt - 1;
				endIdx = Math.min(maxPageInt, pages.length);
			}
		} else if (minPageInt && !maxPageInt) {
			startIdx = minPageInt - 1;
			endIdx = pages.length;
		} else if (!minPageInt && maxPageInt) {
			startIdx = 0;
			endIdx = Math.min(maxPageInt, pages.length);
		}

		return pages.slice(startIdx, endIdx).join('\n\n=== PAGE BREAK ===\n\n');
	}

	// fallback: no page markers
	let result = extractFormattedText(doc.body, false, false, false);
	return postprocessing(result);
}

function removeSkippableTags(doc) {
	const skippableTags = [
		'img',
		'meta',
		'button',
		'input',
		'svg',
		'noscript',
		'iframe',
		'link',
		'head',
		'nav',
		'header',
		'footer',
		'object',
		'embed',
		'canvas',
		'map',
		'area',
		'param',
		'video',
		'audio',
		'track',
		'source',
		'select',
		'base',
		'br',
		'col',
		'hr',
		'wbr',
	];

	skippableTags.forEach((tag) => {
		const elements = doc.querySelectorAll(tag);
		elements.forEach((el) => {
			if (el.parentNode) {
				el.parentNode.removeChild(el);
			}
		});
	});
}

// text with special handling for tables and formatting
function extractFormattedText(node, inScript, inStyle, inTable) {
	if (!node) return '';

	let result = '';

	// element nodes
	if (node.nodeType === Node.ELEMENT_NODE) {
		const tagName = node.nodeName.toLowerCase();

		// track state
		if (tagName === 'script') {
			inScript = true;
		} else if (tagName === 'style') {
			inStyle = true;
		} else if (tagName === 'table') {
			inTable = true;
			result += '\n\nTable: ';
		}

		// tables
		if (inTable) {
			if (tagName === 'tr') {
				result += '\n';
			} else if (tagName === 'td' || tagName === 'th') {
				result += '  ';
			}
		}

		// process children if not in script or style
		if (!inScript && !inStyle) {
			for (const child of node.childNodes) {
				result += extractFormattedText(child, inScript, inStyle, inTable);
			}
		}

		// reset state after closing tags
		if (tagName === 'script') {
			inScript = false;
		} else if (tagName === 'style') {
			inStyle = false;
		} else if (tagName === 'table') {
			inTable = false;
			result += '\nEnd of table\n\n';
		}
	}
	// handle text nodes
	else if (node.nodeType === Node.TEXT_NODE) {
		if (!inScript && !inStyle) {
			const text = node.textContent.trim();
			if (text) {
				result += text + ' ';
			}
		}
	}

	return result;
}

// process HTML entities and clean the output
function postprocessing(input) {
	if (!input) return '';

	const entityMap = {
		'&quot;': '"',
		'&apos;': "'",
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&#160;': ' ',
		'&nbsp;': ' ',
		'&nbsp;nbsp;': ' ',
		'&nbsp;&nbsp;': ' ',
		'&#8217;': "'",
	};

	let output = input;

	// common entities
	for (const [entity, replacement] of Object.entries(entityMap)) {
		output = output.replaceAll(entity, replacement);
	}

	// numeric entities
	output = output.replace(/&#(\d+);/g, (match, numStr) => {
		const num = parseInt(numStr, 10);
		return String.fromCodePoint(num);
	});

	// hex entities
	output = output.replace(/&#[xX]([0-9a-fA-F]+);/g, (match, hexStr) => {
		const num = parseInt(hexStr, 16);
		return String.fromCodePoint(num);
	});

	// clean output
	return cleanOutput(output);
}

function cleanOutput(input) {
	if (!input) return '';

	const tableStart = 'Table:';
	const tableEnd = 'End of table';

	let output = '';
	let consecutiveNewlines = 0;

	// table sections
	let pos = 0;
	let lastPos = 0;

	while ((pos = input.indexOf(tableStart, pos)) !== -1) {
		// content before the table
		appendCleanedSection(input.substring(lastPos, pos));

		// find end of the table
		const endPos = input.indexOf(tableEnd, pos);
		if (endPos === -1) break;

		const tableSection = input.substring(pos, endPos + tableEnd.length);

		// check table has numbers
		const numberCount = countNumbers(tableSection);

		if (numberCount > 1) {
			appendCleanedSection(tableSection);
		}

		pos = endPos + tableEnd.length;
		lastPos = pos;
	}

	// remaining content
	if (lastPos < input.length) {
		appendCleanedSection(input.substring(lastPos));
	}

	function appendCleanedSection(section) {
		for (let i = 0; i < section.length; i++) {
			if (section[i] === '\n') {
				if (consecutiveNewlines < 2) {
					output += '\n';
					consecutiveNewlines++;
				}
			} else {
				output += section[i];
				consecutiveNewlines = 0;
			}
		}
	}

	return output;
}

function countNumbers(text) {
	const numberRegex = /-?(\d+(\.\d*)?|\.\d+)/g;
	const matches = text.match(numberRegex) || [];
	return matches.length;
}
