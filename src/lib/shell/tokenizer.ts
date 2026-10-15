/**
 * Shell tokenizer.
 *
 * Converts an input string into a flat list of tokens that the parser
 * can consume. Follows POSIX rules for quoting and operator recognition.
 *
 * Key rules we implement:
 *  - Single quotes suppress ALL expansion; no escape sequences inside.
 *  - Double quotes allow $, ${...}, $(...), `...`, and backslash-escape of
 *    $, `, ", \ and newline. Other backslashes are literal.
 *  - Backslash outside quotes escapes the next character; backslash+newline
 *    is a line continuation (removed).
 *  - `#` at the start of a token begins a comment to end-of-line.
 *  - Operators: && || | & ; ;; ( ) { } < > >> 2> 2>> &> >& <& <<
 *    Reserved words are returned as WORD tokens; the parser decides
 *    whether they're keywords based on context (POSIX rule).
 *  - Arbitrary fd prefixes on redirections (e.g. `3>file`) are recognized
 *    but only fds 0, 1, 2 are meaningful later.
 */

export type TokenType =
  | 'WORD' // a regular word (may contain segments with different quoting)
  | 'OPERATOR' // a shell control operator
  | 'IO_NUMBER' // a number directly followed by <, >, etc.
  | 'NEWLINE'
  | 'EOF';

export interface TokenSegment {
  type: 'literal' | 'single_quoted' | 'double_quoted' | 'dollar';
  /** Literal text. For `dollar` this is the whole expression (e.g. `$FOO`, `${x}`, `$(cmd)`, `$((1+1))`). */
  value: string;
}

export interface Token {
  type: TokenType;
  /** Raw text of the token as it appeared in input. */
  value: string;
  /** For WORDs, the segments preserve quoting information. Undefined for operators. */
  segments?: TokenSegment[];
  /** Byte offset in the source for error messages. */
  offset: number;
  /** For heredoc delimiter WORDs: the body text, collected verbatim. */
  heredocBody?: string;
}

const OPERATORS = new Set([
  '&&', '||', '|', '&', ';', ';;',
  '(', ')', '{', '}',
  '<', '>', '>>', '<<', '<<-',
  '>&', '<&', '&>', '&>>',
]);

/** Characters that end a plain-word when unquoted and unescaped. */
const WORD_DELIMITERS = new Set([' ', '\t', '\n', '|', '&', ';', '(', ')', '<', '>']);

export class TokenizeError extends Error {
  constructor(message: string, public offset: number) {
    super(`Parse error at offset ${offset}: ${message}`);
  }
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  /** True if we just consumed whitespace/newline/operator and a `#` here starts a comment. */
  let atBoundary = true;
  /** Heredoc delimiters seen on the current line, whose bodies start after the next newline. */
  const pendingHeredocs: { token: Token; stripTabs: boolean }[] = [];

  const peek = (o = 0) => input[i + o];
  const atEnd = () => i >= input.length;

  while (!atEnd()) {
    const c = peek();

    // Line continuation: backslash immediately before newline.
    if (c === '\\' && peek(1) === '\n') {
      i += 2;
      continue;
    }

    // Whitespace (but not newline — newline is a significant token).
    if (c === ' ' || c === '\t') {
      i++;
      atBoundary = true;
      continue;
    }

    // Newline.
    if (c === '\n') {
      tokens.push({ type: 'NEWLINE', value: '\n', offset: i });
      i++;
      atBoundary = true;
      // Heredoc bodies are raw text, not shell syntax: read them now and
      // resume tokenizing after the last delimiter line.
      for (const heredoc of pendingHeredocs) {
        i = readHeredocBody(input, i, heredoc.token, heredoc.stripTabs);
      }
      pendingHeredocs.length = 0;
      continue;
    }

    // Comment: # at a word boundary runs to end of line.
    if (c === '#' && atBoundary) {
      while (!atEnd() && peek() !== '\n') i++;
      continue;
    }

    // Operators.
    const opMatch = matchOperator(input, i);
    if (opMatch) {
      tokens.push({ type: 'OPERATOR', value: opMatch, offset: i });
      i += opMatch.length;
      atBoundary = true;
      continue;
    }

    // IO_NUMBER: digits directly followed by < or >.
    // POSIX treats this as a distinct token type so that `2>file` parses
    // as IO_NUMBER OP WORD rather than a single word.
    const ioNumMatch = matchIoNumber(input, i);
    if (ioNumMatch) {
      tokens.push({ type: 'IO_NUMBER', value: ioNumMatch, offset: i });
      i += ioNumMatch.length;
      atBoundary = false;
      continue;
    }

    // Otherwise, it's a word. `#` inside a word is literal.
    atBoundary = false;
    const wordStart = i;
    const segments: TokenSegment[] = [];
    let raw = '';

    while (!atEnd()) {
      const ch = peek();

      // Line continuation inside a word.
      if (ch === '\\' && peek(1) === '\n') {
        i += 2;
        continue;
      }

      // End of word on unquoted delimiter.
      if (WORD_DELIMITERS.has(ch)) break;

      // Unquoted operator start.
      if (matchOperator(input, i)) break;

      if (ch === "'") {
        // Single-quoted segment: everything until the next ' is literal.
        const start = i;
        i++;
        let body = '';
        while (!atEnd() && peek() !== "'") {
          body += peek();
          i++;
        }
        if (atEnd()) throw new TokenizeError("unterminated single quote", start);
        i++; // closing '
        segments.push({ type: 'single_quoted', value: body });
        raw += input.slice(start, i);
        continue;
      }

      if (ch === '"') {
        // Double-quoted segment: expansions happen inside but we don't
        // re-tokenize. We just collect the raw body (minus the escaping)
        // for the expander to process.
        const start = i;
        i++;
        let body = '';
        while (!atEnd() && peek() !== '"') {
          const dq = peek();
          if (dq === '\\') {
            const nxt = peek(1);
            // Inside "", backslash only escapes $ ` " \ and newline.
            if (nxt === '$' || nxt === '`' || nxt === '"' || nxt === '\\' || nxt === '\n') {
              if (nxt === '\n') {
                // Line continuation even inside "" — strip it.
                i += 2;
                continue;
              }
              body += nxt;
              i += 2;
              continue;
            }
            // Any other backslash is literal.
            body += '\\';
            i++;
            continue;
          }
          body += dq;
          i++;
        }
        if (atEnd()) throw new TokenizeError("unterminated double quote", start);
        i++; // closing "
        segments.push({ type: 'double_quoted', value: body });
        raw += input.slice(start, i);
        continue;
      }

      if (ch === '\\') {
        // Unquoted backslash escapes the next character verbatim (literal).
        const nxt = peek(1);
        if (nxt === undefined) {
          // Trailing backslash — treat as literal.
          segments.push({ type: 'literal', value: '\\' });
          raw += '\\';
          i++;
          continue;
        }
        segments.push({ type: 'literal', value: nxt });
        raw += '\\' + nxt;
        i += 2;
        continue;
      }

      if (ch === '$') {
        const { expr, end } = readDollar(input, i);
        segments.push({ type: 'dollar', value: expr });
        raw += input.slice(i, end);
        i = end;
        continue;
      }

      if (ch === '`') {
        // Backtick command substitution: read until matching backtick.
        const start = i;
        i++;
        let body = '';
        while (!atEnd() && peek() !== '`') {
          if (peek() === '\\' && (peek(1) === '`' || peek(1) === '\\' || peek(1) === '$')) {
            body += peek(1);
            i += 2;
            continue;
          }
          body += peek();
          i++;
        }
        if (atEnd()) throw new TokenizeError('unterminated backtick', start);
        i++; // closing `
        segments.push({ type: 'dollar', value: '$(' + body + ')' });
        raw += input.slice(start, i);
        continue;
      }

      // Plain literal character.
      segments.push({ type: 'literal', value: ch });
      raw += ch;
      i++;
    }

    if (segments.length === 0 && raw === '') {
      // Shouldn't happen, but guard against infinite loops.
      throw new TokenizeError(`unexpected character: ${JSON.stringify(input[i])}`, i);
    }

    // Collapse adjacent literal segments for cleanliness.
    const collapsed = collapseLiterals(segments);
    const word: Token = { type: 'WORD', value: raw, segments: collapsed, offset: wordStart };
    const prev = tokens[tokens.length - 1];
    if (prev && isOperator(prev, '<<', '<<-')) {
      pendingHeredocs.push({ token: word, stripTabs: prev.value === '<<-' });
    }
    tokens.push(word);
  }

  tokens.push({ type: 'EOF', value: '', offset: i });
  return tokens;
}

/**
 * Read a heredoc body starting at offset i (the start of the line after
 * the command), store it on the delimiter token, and return the offset
 * just past the delimiter line. Without a delimiter line, the body runs
 * to the end of the input.
 */
function readHeredocBody(input: string, i: number, delimiter: Token, stripTabs: boolean): number {
  const tag = (delimiter.segments ?? []).map((seg) => seg.value).join('');
  let body = '';
  while (i < input.length) {
    const nl = input.indexOf('\n', i);
    const end = nl === -1 ? input.length : nl;
    let line = input.slice(i, end);
    if (stripTabs) line = line.replace(/^\t+/, '');
    i = nl === -1 ? input.length : nl + 1;
    if (line === tag) break;
    body += line + '\n';
  }
  delimiter.heredocBody = body;
  return i;
}

/** Try to match a multi-character operator at position i, longest first. */
function matchOperator(input: string, i: number): string | null {
  // Longest first.
  const three = input.slice(i, i + 3);
  if (three === '&>>') return '&>>';
  if (three === '<<-') return '<<-';
  const two = input.slice(i, i + 2);
  if (two === '&&') return '&&';
  if (two === '||') return '||';
  if (two === '>>') return '>>';
  if (two === '<<') return '<<';
  if (two === '>&') return '>&';
  if (two === '<&') return '<&';
  if (two === '&>') return '&>';
  if (two === ';;') return ';;';
  const one = input[i];
  if (one === '|' || one === '&' || one === ';' ||
      one === '(' || one === ')' ||
      one === '<' || one === '>') {
    return one;
  }
  return null;
}

/** Match optional fd number followed by < or > (without consuming the operator). */
function matchIoNumber(input: string, i: number): string | null {
  let j = i;
  while (j < input.length && /[0-9]/.test(input[j])) j++;
  if (j === i) return null;
  const next = input[j];
  if (next === '<' || next === '>') return input.slice(i, j);
  return null;
}

/**
 * Read a $-led expression starting at position i (which must point to `$`).
 * Handles $VAR, ${VAR}, $(cmd), $((expr)).
 * Returns the entire raw expression text (including the leading $) and the
 * new offset after it.
 */
function readDollar(input: string, i: number): { expr: string; end: number } {
  const start = i;
  i++; // skip $
  if (i >= input.length) return { expr: '$', end: i };

  const c = input[i];

  if (c === '{') {
    // ${...}: balanced braces (no nesting in POSIX, but we try to be lenient).
    i++;
    let depth = 1;
    while (i < input.length && depth > 0) {
      const ch = input[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth > 0) i++;
    }
    if (depth !== 0) throw new TokenizeError('unterminated ${...}', start);
    i++; // closing }
    return { expr: input.slice(start, i), end: i };
  }

  if (c === '(') {
    // $((...)) or $(...) — check for arithmetic first.
    if (input[i + 1] === '(') {
      i += 2;
      let depth = 2;
      while (i < input.length && depth > 0) {
        const ch = input[i];
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) {
            i++;
            if (input[i] === ')') { i++; break; }
            // malformed — treat as subshell-sub instead.
          }
        }
        if (depth > 0) i++;
      }
      return { expr: input.slice(start, i), end: i };
    }
    // $(cmd): balanced parens, but respect nested quotes.
    i++;
    let depth = 1;
    while (i < input.length && depth > 0) {
      const ch = input[i];
      if (ch === "'") {
        i++;
        while (i < input.length && input[i] !== "'") i++;
        if (i < input.length) i++;
        continue;
      }
      if (ch === '"') {
        i++;
        while (i < input.length && input[i] !== '"') {
          if (input[i] === '\\' && i + 1 < input.length) { i += 2; continue; }
          i++;
        }
        if (i < input.length) i++;
        continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (depth > 0) i++;
    }
    if (depth !== 0) throw new TokenizeError('unterminated $(...)', start);
    i++; // closing )
    return { expr: input.slice(start, i), end: i };
  }

  if (c === '?' || c === '$' || c === '!' || c === '#' || c === '*' || c === '@' || c === '-') {
    // Special single-character params.
    i++;
    return { expr: input.slice(start, i), end: i };
  }

  if (/[A-Za-z_]/.test(c)) {
    while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) i++;
    return { expr: input.slice(start, i), end: i };
  }

  if (/[0-9]/.test(c)) {
    // Positional parameter: just one digit per POSIX.
    i++;
    return { expr: input.slice(start, i), end: i };
  }

  // Lone $, not followed by a name — treat as literal $.
  return { expr: '$', end: i };
}

/** Merge neighbouring literal segments to simplify downstream logic. */
function collapseLiterals(segments: TokenSegment[]): TokenSegment[] {
  const out: TokenSegment[] = [];
  for (const seg of segments) {
    const prev = out[out.length - 1];
    if (seg.type === 'literal' && prev?.type === 'literal') {
      prev.value += seg.value;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

/** True if this token is one of the given operator values. */
export function isOperator(tok: Token, ...ops: string[]): boolean {
  return tok.type === 'OPERATOR' && ops.includes(tok.value);
}

export { OPERATORS };
