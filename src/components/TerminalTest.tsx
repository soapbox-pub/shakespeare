import { useEffect } from 'react';
import { Terminal } from './Terminal';

/**
 * A test component to verify ANSI color code rendering in the terminal
 */
export function TerminalTest() {
  return (
    <div className="h-[500px] w-full">
      <Terminal projectId="test" />
    </div>
  );
}
