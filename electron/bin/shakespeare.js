#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import electron from 'electron';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPath = join(__dirname, '..');

const child = spawn(electron, [appPath], {
  stdio: 'inherit',
  windowsHide: false,
});

child.on('close', code => process.exit(code ?? 0));
child.on('error', err => {
  console.error('Failed to launch Electron:', err);
  process.exit(1);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
