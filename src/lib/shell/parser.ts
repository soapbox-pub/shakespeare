/**
 * Shell parser.
 *
 * Consumes the token stream produced by tokenizer.ts and emits a
 * CommandList (AST) that the executor can walk. Handles:
 *   - pipelines (|)
 *   - and-or lists (&&, ||)
 *   - sequences (;, newline)
 *   - compound: for, while, until, if, case, subshell (…), group {…}
 *   - redirections (including fd numbers and heredocs)
 *
 * Heredoc bodies are collected by the tokenizer and attached to the
 * delimiter token.
 */

import type {
  CommandList, Command, SimpleCommand,
  ForLoop, WhileLoop, IfStatement, CaseStatement, Subshell, Group,
  Redirection, Word, WordSegment, RedirOp,
} from './ast';
import type { Token, TokenSegment } from './tokenizer';

export class ParseError extends Error {
  constructor(message: string, public offset: number) {
    super(`Parse error at offset ${offset}: ${message}`);
  }
}

/** A parser consumes the token stream. */
class Parser {
  private pos = 0;
  /**
   * Stack of active compound-body terminators. When a simple command
   * is being parsed and its next token matches any active terminator,
   * we stop consuming so the enclosing compound parser can handle it.
   *
   * Without this, `done`, `fi`, `then`, `;;`, `}` at the top level
   * would terminate a simple command that legitimately wants to use
   * them as argument values (e.g. `echo done`).
   */
  private terminatorStack: string[][] = [];

  constructor(private readonly tokens: Token[]) {}

  private isActiveTerminator(word: string): boolean {
    for (const set of this.terminatorStack) {
      if (set.includes(word)) return true;
    }
    return false;
  }

  /** Top-level: parse a full script, which is a list of commands. */
  parseScript(): CommandList {
    const commands: Command[] = [];
    this.skipNewlines();
    while (!this.atEnd()) {
      const cmd = this.parseAndOr();
      commands.push(cmd);
      // Optional terminator: ; or newline.
      if (this.isOp(';') || this.isOp('&')) {
        // `&` turns the preceding command into a background job; we
        // don't actually background anything (single-threaded VFS), but
        // we accept the syntax and warn.
        this.advance();
      }
      this.skipNewlines();
    }
    return { type: 'list', commands };
  }

  /** Parse AndOrList: pipeline ( (&&|||) pipeline )* */
  private parseAndOr(): Command {
    const first = this.parsePipeline();
    const rest: { op: '&&' | '||'; command: Command }[] = [];
    while (this.isOp('&&') || this.isOp('||')) {
      const op = this.peek().value as '&&' | '||';
      this.advance();
      this.skipNewlines();
      rest.push({ op, command: this.parsePipeline() });
    }
    if (rest.length === 0) return first;
    return { type: 'and_or', first, rest };
  }

  /** Parse Pipeline: [!] command ( | command )* */
  private parsePipeline(): Command {
    let negated = false;
    if (this.peek().type === 'WORD' && this.peek().value === '!') {
      negated = true;
      this.advance();
    }
    const commands: Command[] = [this.parseCommand()];
    while (this.isOp('|')) {
      this.advance();
      this.skipNewlines();
      commands.push(this.parseCommand());
    }
    if (!negated && commands.length === 1) return commands[0];
    return { type: 'pipeline', negated, commands };
  }

  /** Parse a single Command (simple or compound). */
  private parseCommand(): Command {
    const t = this.peek();

    // Compound commands keyed off reserved words (only honored when
    // appearing in command position, which is always the case here).
    if (t.type === 'WORD') {
      switch (t.value) {
        case 'for':    return this.parseFor();
        case 'while':  return this.parseWhile(false);
        case 'until':  return this.parseWhile(true);
        case 'if':     return this.parseIf();
        case 'case':   return this.parseCase();
        case '{':      return this.parseGroup();
      }
    }
    if (this.isOp('(')) return this.parseSubshell();

    return this.parseSimple();
  }

  private parseFor(): ForLoop {
    this.expectWord('for');
    const varTok = this.expect('WORD', 'variable name after `for`');
    const variable = varTok.value;
    this.skipNewlines();

    let items: Word[] | undefined;
    if (this.peekWordIs('in')) {
      this.advance();
      items = [];
      while (!this.isTerminator() && !this.peekWordIs('do')) {
        items.push(this.consumeWord());
      }
      this.consumeTerminators();
    } else {
      this.consumeTerminators();
    }

    this.expectWord('do');
    this.skipNewlines();
    const body = this.parseCompoundBody('done');
    this.expectWord('done');
    return { type: 'for', variable, items, body };
  }

  private parseWhile(until: boolean): WhileLoop {
    this.expectWord(until ? 'until' : 'while');
    this.skipNewlines();
    const condition = this.parseCompoundBody('do');
    this.expectWord('do');
    this.skipNewlines();
    const body = this.parseCompoundBody('done');
    this.expectWord('done');
    return { type: 'while', condition, body, until };
  }

  private parseIf(): IfStatement {
    this.expectWord('if');
    this.skipNewlines();
    const condition = this.parseCompoundBody('then');
    this.expectWord('then');
    this.skipNewlines();
    const thenBlock = this.parseCompoundBody('elif', 'else', 'fi');
    const elifs: IfStatement['elifs'] = [];
    while (this.peekWordIs('elif')) {
      this.advance();
      this.skipNewlines();
      const cond = this.parseCompoundBody('then');
      this.expectWord('then');
      this.skipNewlines();
      const body = this.parseCompoundBody('elif', 'else', 'fi');
      elifs.push({ condition: cond, then: body });
    }
    let elseBlock: CommandList | undefined;
    if (this.peekWordIs('else')) {
      this.advance();
      this.skipNewlines();
      elseBlock = this.parseCompoundBody('fi');
    }
    this.expectWord('fi');
    return { type: 'if', condition, then: thenBlock, elifs, else: elseBlock };
  }

  private parseCase(): CaseStatement {
    this.expectWord('case');
    const subject = this.consumeWord();
    this.skipNewlines();
    this.expectWord('in');
    this.skipNewlines();
    const items: CaseStatement['items'] = [];
    while (!this.peekWordIs('esac') && !this.atEnd()) {
      // Optional leading (
      if (this.isOp('(')) this.advance();
      const patterns: Word[] = [this.consumeWord()];
      while (this.isOp('|')) {
        this.advance();
        patterns.push(this.consumeWord());
      }
      if (!this.isOp(')')) {
        throw new ParseError('expected `)` in case pattern', this.peek().offset);
      }
      this.advance();
      this.skipNewlines();
      const body = this.parseCompoundBody(';;', 'esac');
      items.push({ patterns, body });
      if (this.isOp(';;')) {
        this.advance();
        this.skipNewlines();
      }
    }
    this.expectWord('esac');
    return { type: 'case', subject, items };
  }

  private parseGroup(): Group {
    this.expectWord('{');
    this.skipNewlines();
    const body = this.parseCompoundBody('}');
    this.expectWord('}');
    const redirections = this.parseRedirections();
    return { type: 'group', body, redirections };
  }

  private parseSubshell(): Subshell {
    this.expect('OPERATOR', '('); // (
    this.skipNewlines();
    const body = this.parseCompoundBody(')');
    if (!this.isOp(')')) {
      throw new ParseError('expected `)` to close subshell', this.peek().offset);
    }
    this.advance();
    const redirections = this.parseRedirections();
    return { type: 'subshell', body, redirections };
  }

  /** Parse a list of commands until one of the given terminators appears. */
  private parseCompoundBody(...terminators: string[]): CommandList {
    this.terminatorStack.push(terminators);
    try {
      const commands: Command[] = [];
      this.skipNewlines();
      while (!this.atEnd() && !this.peekTerminates(terminators)) {
        commands.push(this.parseAndOr());
        if (this.isOp(';') || this.isOp('&')) this.advance();
        this.skipNewlines();
      }
      return { type: 'list', commands };
    } finally {
      this.terminatorStack.pop();
    }
  }

  private peekTerminates(terminators: string[]): boolean {
    const t = this.peek();
    if (t.type === 'WORD' && terminators.includes(t.value)) return true;
    if (t.type === 'OPERATOR' && terminators.includes(t.value)) return true;
    return false;
  }

  /** Parse a simple command: [redirs] word [word|redir]* */
  private parseSimple(): SimpleCommand {
    const cmd: SimpleCommand = {
      type: 'simple',
      assignments: [],
      words: [],
      redirections: [],
    };

    // Leading redirections (e.g. `>out ls`).
    while (this.peekIsRedirStart()) {
      cmd.redirections.push(this.parseRedirection());
    }

    // Inline variable assignments before the command name.
    while (this.peekIsAssignment() && cmd.words.length === 0) {
      const tok = this.advance();
      const eq = tok.value.indexOf('=');
      const name = tok.value.slice(0, eq);
      const valueText = tok.value.slice(eq + 1);
      // Build a Word from the post-= part of the token's segments.
      cmd.assignments.push({ name, value: segmentsAfterChar(tok, eq + 1, valueText) });
    }

    // Command name + arguments, interleaved with redirections.
    while (!this.atEnd()) {
      const startPos = this.pos;
      if (this.peekIsRedirStart()) {
        cmd.redirections.push(this.parseRedirection());
        continue;
      }
      const t = this.peek();
      if (t.type !== 'WORD') break;
      // A bare reserved word is only a terminator if we're currently
      // parsing inside a compound body that's expecting it. Otherwise
      // it's just an argument (e.g. `echo done` at top level).
      if (this.isActiveTerminator(t.value)) break;
      // `;;` is a case-item separator, handled as an OPERATOR. `}` is
      // an operator too. These don't reach here as WORDs.
      cmd.words.push(this.consumeWord());

      // Safety: if we failed to advance, bail rather than hang.
      if (this.pos === startPos) {
        throw new ParseError(`unexpected token: ${this.peek().value}`, this.peek().offset);
      }
    }

    if (cmd.words.length === 0 && cmd.redirections.length === 0 && cmd.assignments.length === 0) {
      // Didn't parse anything — make sure the caller sees progress or an
      // explicit error rather than looping.
      throw new ParseError(`expected command, got "${this.peek().value}"`, this.peek().offset);
    }

    return cmd;
  }

  private peekIsRedirStart(): boolean {
    const t = this.peek();
    if (t.type === 'IO_NUMBER') return true;
    if (t.type === 'OPERATOR' && ['<', '>', '>>', '<<', '<<-', '>&', '<&', '&>', '&>>'].includes(t.value)) return true;
    return false;
  }

  private peekIsAssignment(): boolean {
    const t = this.peek();
    if (t.type !== 'WORD' || !t.segments || t.segments.length === 0) return false;
    const first = t.segments[0];
    if (first.type !== 'literal') return false;
    const m = first.value.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    return !!m;
  }

  private parseRedirection(): Redirection {
    let fd: number | undefined;
    const first = this.peek();
    if (first.type === 'IO_NUMBER') {
      fd = parseInt(first.value, 10);
      this.advance();
    }
    const op = this.expect('OPERATOR', 'redirection operator');
    const opStr = op.value as RedirOp | string;

    // Map the operator string into our RedirOp set.
    let realOp: RedirOp;
    switch (opStr) {
      case '>':   realOp = fd === 2 ? '2>' : '>'; break;
      case '>>':  realOp = fd === 2 ? '2>>' : '>>'; break;
      case '<':   realOp = '<'; break;
      case '<<':  case '<<-': realOp = '<<'; break;
      case '>&':  realOp = '>&'; break;
      case '<&':  realOp = '<&'; break;
      case '&>':  realOp = '&>'; break;
      case '&>>': realOp = '&>'; break; // treat like &> (rare)
      default:
        throw new ParseError(`unexpected redirection operator: ${opStr}`, op.offset);
    }

    // For >&/<& the target may be a number (fd dup).
    if (realOp === '>&' || realOp === '<&') {
      const t = this.expect('WORD', 'target for fd duplication');
      if (/^[0-9]+$/.test(t.value)) {
        return { op: realOp, fd: fd ?? (realOp === '>&' ? 1 : 0), target: { fd: parseInt(t.value, 10) } };
      }
      // Could also be a filename (e.g. bash's >&file). Treat as file.
      return { op: realOp === '>&' ? '>' : '<', fd: fd ?? (realOp === '>&' ? 1 : 0), target: tokenToWord(t) };
    }

    // Heredoc: the tokenizer has already collected the body onto the delimiter.
    if (realOp === '<<') {
      const tagTok = this.expect('WORD', 'heredoc delimiter');
      const expand = isHeredocExpanded(tagTok);
      return { op: '<<', fd: fd ?? 0, target: tokenToWord(tagTok), heredocBody: tagTok.heredocBody ?? '', heredocExpand: expand };
    }

    const target = this.expect('WORD', 'redirection target');
    return { op: realOp, fd, target: tokenToWord(target) };
  }

  /** Parse trailing redirections after a compound command. */
  private parseRedirections(): Redirection[] {
    const out: Redirection[] = [];
    while (this.peekIsRedirStart()) {
      out.push(this.parseRedirection());
    }
    return out;
  }

  // -----------------------------------------------------------------
  // Token utility methods
  // -----------------------------------------------------------------

  private peek(): Token { return this.tokens[this.pos]; }
  private advance(): Token { return this.tokens[this.pos++]; }
  private atEnd(): boolean { return this.peek().type === 'EOF'; }

  private skipNewlines(): void {
    while (this.peek().type === 'NEWLINE') this.advance();
  }

  private isOp(value: string): boolean {
    const t = this.peek();
    return t.type === 'OPERATOR' && t.value === value;
  }

  private peekWordIs(value: string): boolean {
    const t = this.peek();
    return t.type === 'WORD' && t.value === value;
  }

  private expect(type: Token['type'], description: string): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new ParseError(`expected ${description}, got ${t.type} "${t.value}"`, t.offset);
    }
    return this.advance();
  }

  private expectWord(value: string): Token {
    const t = this.peek();
    if (t.type !== 'WORD' || t.value !== value) {
      throw new ParseError(`expected "${value}", got ${t.type} "${t.value}"`, t.offset);
    }
    return this.advance();
  }

  private isTerminator(): boolean {
    const t = this.peek();
    return t.type === 'NEWLINE' || t.type === 'EOF' ||
      (t.type === 'OPERATOR' && (t.value === ';' || t.value === '&'));
  }

  private consumeTerminators(): void {
    while (this.isTerminator()) this.advance();
  }

  private consumeWord(): Word {
    const t = this.peek();
    if (t.type !== 'WORD') {
      throw new ParseError(`expected word, got ${t.type} "${t.value}"`, t.offset);
    }
    this.advance();
    return tokenToWord(t);
  }
}

/** Export: parse a token stream into a CommandList AST. */
export function parse(tokens: Token[]): CommandList {
  const parser = new Parser(tokens);
  return parser.parseScript();
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function tokenToWord(tok: Token): Word {
  if (!tok.segments) {
    return { segments: [{ type: 'literal', value: tok.value }] };
  }
  return { segments: tok.segments.map(tokenSegmentToWordSegment) };
}

function tokenSegmentToWordSegment(seg: TokenSegment): WordSegment {
  if (seg.type === 'literal') return { type: 'literal', value: seg.value };
  if (seg.type === 'single_quoted') return { type: 'single_quoted', value: seg.value };
  if (seg.type === 'double_quoted') {
    return { type: 'double_quoted', segments: splitDoubleQuotedBody(seg.value) };
  }
  // dollar-prefixed expression
  return classifyDollar(seg.value);
}

/**
 * Inside a double-quoted segment, further split into text vs $-exprs.
 * We do a lightweight re-scan here (not a full tokenize) since we already
 * have a clean string.
 */
function splitDoubleQuotedBody(body: string): WordSegment[] {
  const out: WordSegment[] = [];
  let i = 0;
  let lit = '';
  const flushLit = () => {
    if (lit) { out.push({ type: 'literal', value: lit }); lit = ''; }
  };
  while (i < body.length) {
    const c = body[i];
    if (c === '$') {
      // Replicate the dollar-reader logic (simpler: support $NAME, ${...}, $(...), $?, $@, $#)
      const { expr, end } = readDollarInString(body, i);
      flushLit();
      out.push(classifyDollar(expr));
      i = end;
      continue;
    }
    if (c === '`') {
      // Backticks inside double quotes.
      const end = body.indexOf('`', i + 1);
      if (end === -1) { lit += c; i++; continue; }
      flushLit();
      out.push({ type: 'command_substitution', script: body.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    lit += c;
    i++;
  }
  flushLit();
  return out;
}

function readDollarInString(s: string, i: number): { expr: string; end: number } {
  const start = i;
  i++;
  if (i >= s.length) return { expr: '$', end: i };
  const c = s[i];
  if (c === '{') {
    i++;
    let depth = 1;
    while (i < s.length && depth > 0) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') { depth--; if (depth === 0) break; }
      i++;
    }
    if (i < s.length) i++;
    return { expr: s.slice(start, i), end: i };
  }
  if (c === '(') {
    if (s[i + 1] === '(') {
      i += 2;
      let depth = 2;
      while (i < s.length && depth > 0) {
        if (s[i] === '(') depth++;
        else if (s[i] === ')') { depth--; if (depth === 0) { i++; if (s[i] === ')') i++; break; } }
        i++;
      }
      return { expr: s.slice(start, i), end: i };
    }
    i++;
    let depth = 1;
    while (i < s.length && depth > 0) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') { depth--; if (depth === 0) break; }
      i++;
    }
    if (i < s.length) i++;
    return { expr: s.slice(start, i), end: i };
  }
  if (/[A-Za-z_]/.test(c)) {
    while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
    return { expr: s.slice(start, i), end: i };
  }
  if (c === '?' || c === '$' || c === '!' || c === '#' || c === '*' || c === '@' || c === '-' || /[0-9]/.test(c)) {
    i++;
    return { expr: s.slice(start, i), end: i };
  }
  return { expr: '$', end: i };
}

/** Classify a $-prefixed expression string into a WordSegment. */
function classifyDollar(expr: string): WordSegment {
  if (expr === '$') return { type: 'literal', value: '$' };
  if (expr.startsWith('$((') && expr.endsWith('))')) {
    return { type: 'arithmetic', expression: expr.slice(3, -2) };
  }
  if (expr.startsWith('$(') && expr.endsWith(')')) {
    return { type: 'command_substitution', script: expr.slice(2, -1) };
  }
  if (expr.startsWith('${') && expr.endsWith('}')) {
    return { type: 'param', name: expr.slice(2, -1) };
  }
  // $NAME or $?
  return { type: 'param', name: expr.slice(1) };
}

/** Build a Word from the suffix of a token's segments after an `=`. */
function segmentsAfterChar(_tok: Token, _charIndex: number, valueText: string): Word {
  // Rough: for simple cases (no quoting across the `=`), build a literal
  // word from the post-= text. Full fidelity would walk the original
  // segments, but inline assignments with quotes are edge cases.
  return { segments: [{ type: 'literal', value: valueText }] };
}

/** A quoted heredoc delimiter disables expansion in the body. */
function isHeredocExpanded(tok: Token): boolean {
  return !tok.segments?.some((seg) => seg.type === 'single_quoted' || seg.type === 'double_quoted');
}
