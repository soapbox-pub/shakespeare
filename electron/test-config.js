#!/usr/bin/env node

/**
 * Test script to validate electron-builder configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Validating Electron build configuration...\n');

const errors = [];
const warnings = [];

// Check if required files exist
const requiredFiles = [
  'electron/main.js',
  'electron/preload.js',
  'electron/builder.config.js',
  'public/shakespeare-512x512.png',
  'package.json',
];

console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file}`);
    errors.push(`Missing required file: ${file}`);
  }
});

// Check if dist directory exists
console.log('\n📦 Checking build output:');
if (fs.existsSync('dist')) {
  const distFiles = fs.readdirSync('dist');
  if (distFiles.includes('index.html')) {
    console.log('  ✅ dist/index.html exists');
  } else {
    console.log('  ❌ dist/index.html missing');
    errors.push('Run "npm run build" first to create dist/index.html');
  }
} else {
  console.log('  ❌ dist directory missing');
  errors.push('Run "npm run build" first to create the dist directory');
}

// Check package.json
console.log('\n📄 Checking package.json:');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  if (pkg.main === 'electron/main.js') {
    console.log('  ✅ main entry point set correctly');
  } else {
    console.log(`  ⚠️  main entry point is "${pkg.main}" (expected "electron/main.js")`);
    warnings.push('package.json main should be "electron/main.js"');
  }

  if (pkg.devDependencies?.electron) {
    console.log('  ✅ electron dependency found');
  } else {
    console.log('  ❌ electron dependency missing');
    errors.push('Install electron: npm install --save-dev electron');
  }

  if (pkg.devDependencies?.['electron-builder']) {
    console.log('  ✅ electron-builder dependency found');
  } else {
    console.log('  ❌ electron-builder dependency missing');
    errors.push('Install electron-builder: npm install --save-dev electron-builder');
  }
} catch (e) {
  console.log('  ❌ Error reading package.json');
  errors.push(`Failed to read package.json: ${e.message}`);
}

// Check builder config
console.log('\n⚙️  Checking builder configuration:');
try {
  const configModule = await import('./builder.config.js');
  const config = configModule.default;

  if (config.appId) {
    console.log(`  ✅ appId: ${config.appId}`);
  } else {
    console.log('  ⚠️  appId not set');
    warnings.push('Consider setting appId in builder.config.js');
  }

  if (config.productName) {
    console.log(`  ✅ productName: ${config.productName}`);
  } else {
    console.log('  ⚠️  productName not set');
    warnings.push('Consider setting productName in builder.config.js');
  }

  // Check icon paths
  const iconPaths = [];
  if (config.mac?.icon) iconPaths.push({ platform: 'macOS', path: config.mac.icon });
  if (config.win?.icon) iconPaths.push({ platform: 'Windows', path: config.win.icon });
  if (config.linux?.icon) iconPaths.push({ platform: 'Linux', path: config.linux.icon });

  console.log('\n🎨 Checking icon configuration:');
  iconPaths.forEach(({ platform, path: iconPath }) => {
    if (fs.existsSync(iconPath)) {
      console.log(`  ✅ ${platform}: ${iconPath}`);
    } else {
      console.log(`  ⚠️  ${platform}: ${iconPath} (will be generated from PNG)`);
    }
  });

} catch (e) {
  console.log('  ❌ Error reading builder.config.js');
  errors.push(`Failed to read builder.config.js: ${e.message}`);
}

// Summary
console.log('\n' + '='.repeat(60));
if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Configuration is valid! Ready to build.');
  console.log('\nNext steps:');
  console.log('  Development: npm run electron:dev');
  console.log('  Build:       npm run electron:build');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log('❌ Errors found:');
    errors.forEach(err => console.log(`  - ${err}`));
  }
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warn => console.log(`  - ${warn}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ Fix errors before building.');
    process.exit(1);
  } else {
    console.log('\n✅ Configuration is valid (with warnings).');
    process.exit(0);
  }
}
