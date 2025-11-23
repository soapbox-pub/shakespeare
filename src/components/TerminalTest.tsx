import { Terminal } from './Terminal';

/**
 * A test component to verify ANSI color code rendering in the terminal
 */
export function TerminalTest() {
  return (
    <div className="h-[500px] w-full">
      <Terminal cwd="/projects/test" />
    </div>
  );
}
