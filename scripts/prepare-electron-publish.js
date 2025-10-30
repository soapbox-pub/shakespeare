#!/usr/bin/env node

import { readFileSync, writeFileSync, copyFileSync, rmSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const electronDir = join(rootDir, 'electron');
const distDir = join(rootDir, 'dist');
const electronDistDir = join(electronDir, 'dist');

// Read root package.json
const rootPackage = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));

// Generate CalVer version (YYYY.MM.DDHHMM)
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hour = String(now.getUTCHours()).padStart(2, '0');
const minute = String(now.getUTCMinutes()).padStart(2, '0');
const version = `${year}.${month}.${day}${hour}${minute}`;

// Get electron version from root devDependencies
const electronVersion = rootPackage.devDependencies.electron;

// Remove old electron/dist and copy new one
console.log('Removing old electron/dist...');
rmSync(electronDistDir, { recursive: true, force: true });

console.log('Copying dist to electron/dist...');
cpSync(distDir, electronDistDir, { recursive: true });

// Create electron package.json
const electronPackage = {
  name: rootPackage.name,
  description: rootPackage.description,
  homepage: rootPackage.homepage,
  license: rootPackage.license,
  version: version,
  type: "module",
  main: "main.js",
  bin: {
    shakespeare: "./bin/shakespeare.js"
  },
  files: [
    "bin/",
    "dist/",
    "main.js",
    "package.json",
    "preload.js",
    "LICENSE",
    "README.md"
  ],
  author: rootPackage.author,
  repository: rootPackage.repository,
  dependencies: {
    electron: electronVersion
  }
};

// Write electron package.json
writeFileSync(
  join(electronDir, 'package.json'),
  JSON.stringify(electronPackage, null, 2) + '\n',
  'utf-8'
);

// Copy README.md to electron directory
copyFileSync(
  join(rootDir, 'README.md'),
  join(electronDir, 'README.md')
);

console.log(`✓ Generated electron/package.json with version ${version}`);
console.log('✓ Copied README.md to electron/');
