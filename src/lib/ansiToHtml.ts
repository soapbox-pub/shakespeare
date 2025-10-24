/**
 * Utility to convert ANSI color codes to HTML spans with appropriate CSS classes
 */

// ANSI color code mapping to Tailwind CSS classes
const colorMap: Record<string, string> = {
  '30': 'text-black',
  '31': 'text-red-500',
  '32': 'text-green-500',
  '33': 'text-yellow-500',
  '34': 'text-blue-500',
  '35': 'text-purple-500',
  '36': 'text-cyan-500',
  '37': 'text-gray-200',
  '90': 'text-gray-400',
  '91': 'text-red-400',
  '92': 'text-green-400',
  '93': 'text-yellow-400',
  '94': 'text-blue-400',
  '95': 'text-purple-400',
  '96': 'text-cyan-400',
  '97': 'text-white',
};

// Background color mapping
const bgColorMap: Record<string, string> = {
  '40': 'bg-black',
  '41': 'bg-red-500',
  '42': 'bg-green-500',
  '43': 'bg-yellow-500',
  '44': 'bg-blue-500',
  '45': 'bg-purple-500',
  '46': 'bg-cyan-500',
  '47': 'bg-gray-200',
};

// Style mapping
const styleMap: Record<string, string> = {
  '1': 'font-bold',
  '2': 'opacity-75',
  '3': 'italic',
  '4': 'underline',
  '9': 'line-through',
};

/**
 * Convert ANSI escape sequences to HTML with appropriate CSS classes
 */
export function ansiToHtml(text: string): string {
  // Regular expression to match ANSI escape sequences
  const ansiRegex = /\u001b\[((?:\d+;)*\d+)m/g;

  // Initialize result and current style classes
  let result = '';
  let currentClasses: string[] = [];

  // Find all matches and their positions
  const matches: Array<{index: number, length: number, codes: string}> = [];
  let match;

  while ((match = ansiRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      codes: match[1]
    });
  }

  // If no ANSI codes found, return the original text
  if (matches.length === 0) {
    return text;
  }

  // Process the text with ANSI codes
  let lastIndex = 0;

  for (const match of matches) {
    // Add text before this match with current styling
    if (match.index > lastIndex) {
      const textSegment = text.substring(lastIndex, match.index);
      if (currentClasses.length > 0) {
        result += `<span class="${currentClasses.join(' ')}">${textSegment}</span>`;
      } else {
        result += textSegment;
      }
    }

    // Update current classes based on ANSI codes
    const codes = match.codes.split(';');

    for (const code of codes) {
      if (code === '0') {
        // Reset all styles
        currentClasses = [];
      } else if (colorMap[code]) {
        // Remove any existing text color classes
        currentClasses = currentClasses.filter(cls => !Object.values(colorMap).includes(cls));
        // Add the new text color
        currentClasses.push(colorMap[code]);
      } else if (bgColorMap[code]) {
        // Remove any existing background color classes
        currentClasses = currentClasses.filter(cls => !Object.values(bgColorMap).includes(cls));
        // Add the new background color
        currentClasses.push(bgColorMap[code]);
      } else if (styleMap[code]) {
        // Add style if it doesn't exist yet
        if (!currentClasses.includes(styleMap[code])) {
          currentClasses.push(styleMap[code]);
        }
      }
    }

    // Update lastIndex to after this match
    lastIndex = match.index + match.length;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    const textSegment = text.substring(lastIndex);
    if (currentClasses.length > 0) {
      result += `<span class="${currentClasses.join(' ')}">${textSegment}</span>`;
    } else {
      result += textSegment;
    }
  }

  return result;
}

/**
 * Check if a string contains ANSI escape sequences
 */
export function containsAnsiCodes(text: string): boolean {
  return /\u001b\[(?:\d+;)*\d+m/.test(text);
}

/**
 * Strip all ANSI escape sequences from a string
 * This removes color codes, cursor movements, and other terminal control sequences
 */
export function stripAnsiCodes(text: string): string {
  // Remove all ANSI escape sequences
  // This regex matches:
  // - Color codes: \u001b[...m
  // - Cursor movement: \u001b[...H, \u001b[...A, etc.
  // - Clear screen: \u001b[...J, \u001b[...K
  // - Other escape sequences
  return text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
}