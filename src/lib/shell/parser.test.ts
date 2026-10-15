import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenizer';
import { parse, ParseError } from './parser';
import type { CommandList, SimpleCommand, Pipeline, AndOrList, ForLoop, IfStatement, WhileLoop } from './ast';

function parseStr(src: string): CommandList {
  return parse(tokenize(src));
}

describe('parse', () => {
  it('parses a simple command', () => {
    const ast = parseStr('echo hello world');
    expect(ast.commands).toHaveLength(1);
    const cmd = ast.commands[0] as SimpleCommand;
    expect(cmd.type).toBe('simple');
    expect(cmd.words.map((w) => w.segments)).toEqual([
      [{ type: 'literal', value: 'echo' }],
      [{ type: 'literal', value: 'hello' }],
      [{ type: 'literal', value: 'world' }],
    ]);
  });

  it('parses && and || chains', () => {
    const ast = parseStr('a && b || c');
    const node = ast.commands[0] as AndOrList;
    expect(node.type).toBe('and_or');
    expect(node.rest).toHaveLength(2);
    expect(node.rest[0].op).toBe('&&');
    expect(node.rest[1].op).toBe('||');
  });

  it('parses pipelines', () => {
    const ast = parseStr('a | b | c');
    const node = ast.commands[0] as Pipeline;
    expect(node.type).toBe('pipeline');
    expect(node.commands).toHaveLength(3);
  });

  it('parses ; as sequence', () => {
    const ast = parseStr('a; b; c');
    expect(ast.commands).toHaveLength(3);
  });

  it('parses a redirection', () => {
    const ast = parseStr('echo hi > out.txt');
    const cmd = ast.commands[0] as SimpleCommand;
    expect(cmd.redirections).toHaveLength(1);
    expect(cmd.redirections[0].op).toBe('>');
  });

  it('parses 2>&1 as fd dup', () => {
    const ast = parseStr('cmd 2>&1');
    const cmd = ast.commands[0] as SimpleCommand;
    expect(cmd.redirections).toHaveLength(1);
    expect(cmd.redirections[0]).toEqual({
      op: '>&',
      fd: 2,
      target: { fd: 1 },
    });
  });

  it('parses 2>file as stderr redir', () => {
    const ast = parseStr('cmd 2> err.log');
    const cmd = ast.commands[0] as SimpleCommand;
    expect(cmd.redirections[0].op).toBe('2>');
    expect(cmd.redirections[0].fd).toBe(2);
  });

  it('parses a for loop', () => {
    const ast = parseStr('for f in a b c; do echo $f; done');
    const node = ast.commands[0] as ForLoop;
    expect(node.type).toBe('for');
    expect(node.variable).toBe('f');
    expect(node.items).toHaveLength(3);
    expect(node.body.commands).toHaveLength(1);
  });

  it('parses a multi-line for loop', () => {
    const ast = parseStr('for f in a b c\ndo\n  echo $f\ndone');
    const node = ast.commands[0] as ForLoop;
    expect(node.type).toBe('for');
    expect(node.items).toHaveLength(3);
    expect(node.body.commands).toHaveLength(1);
  });

  it('parses an if statement', () => {
    const ast = parseStr('if true; then echo yes; else echo no; fi');
    const node = ast.commands[0] as IfStatement;
    expect(node.type).toBe('if');
    expect(node.then.commands).toHaveLength(1);
    expect(node.else?.commands).toHaveLength(1);
  });

  it('parses if/elif/else', () => {
    const ast = parseStr('if a; then x; elif b; then y; else z; fi');
    const node = ast.commands[0] as IfStatement;
    expect(node.elifs).toHaveLength(1);
    expect(node.else).toBeDefined();
  });

  it('parses a while loop', () => {
    const ast = parseStr('while true; do echo hi; done');
    const node = ast.commands[0] as WhileLoop;
    expect(node.type).toBe('while');
    expect(node.until).toBe(false);
  });

  it('parses an until loop', () => {
    const ast = parseStr('until false; do echo hi; done');
    const node = ast.commands[0] as WhileLoop;
    expect(node.until).toBe(true);
  });

  it('parses a subshell', () => {
    const ast = parseStr('(cd foo; ls)');
    expect(ast.commands[0].type).toBe('subshell');
  });

  it('parses a brace group', () => {
    const ast = parseStr('{ echo a; echo b; }');
    expect(ast.commands[0].type).toBe('group');
  });

  it('parses a heredoc', () => {
    const ast = parseStr('cat <<EOF\nline1\nline2\nEOF');
    const cmd = ast.commands[0] as SimpleCommand;
    expect(cmd.redirections).toHaveLength(1);
    expect(cmd.redirections[0].op).toBe('<<');
    expect(cmd.redirections[0].heredocBody).toBe('line1\nline2\n');
    expect(cmd.redirections[0].heredocExpand).toBe(true);
  });

  it('parses a quoted heredoc (no expansion)', () => {
    const ast = parseStr("cat <<'EOF'\n$HOME\nEOF");
    const cmd = ast.commands[0] as SimpleCommand;
    expect(cmd.redirections[0].heredocExpand).toBe(false);
    expect(cmd.redirections[0].heredocBody).toBe('$HOME\n');
  });

  it('does not tokenize heredoc bodies as shell syntax', () => {
    const ast = parseStr("cat <<'E'\nit's `x` \"y ${z\nE");
    const cmd = ast.commands[0] as SimpleCommand;
    expect(cmd.redirections[0].heredocBody).toBe("it's `x` \"y ${z\n");
  });

  it('parses the commands after a heredoc separately', () => {
    const ast = parseStr("cat > a <<'E'\none\nE\ncat > b <<'E'\ntwo\nE\necho done");
    expect(ast.commands).toHaveLength(3);
    const [a, b, echo] = ast.commands as SimpleCommand[];
    expect(a.redirections[1].heredocBody).toBe('one\n');
    expect(b.redirections[1].heredocBody).toBe('two\n');
    expect(echo.words).toHaveLength(2);
  });

  it('reads multiple heredocs on one line in order', () => {
    const ast = parseStr('cat <<A && cat <<B\nfirst\nA\nsecond\nB\necho done');
    expect(ast.commands).toHaveLength(2);
  });

  it('throws on unclosed for', () => {
    expect(() => parseStr('for f in a b c; do echo $f')).toThrow(ParseError);
  });

  it('parses negated pipeline', () => {
    const ast = parseStr('! false');
    const node = ast.commands[0] as Pipeline;
    expect(node.type).toBe('pipeline');
    expect(node.negated).toBe(true);
  });
});
