/**
 * Test script to verify real terminal execution in Electron
 * 
 * This script can be run in the Electron console to test the shell execution:
 * 
 * 1. Start Electron: npm run electron:dev
 * 2. Open DevTools
 * 3. Copy and paste this code into the console
 */

async function testElectronShell() {
  console.log('Testing Electron Shell Execution...\n');

  if (!window.electron?.shell) {
    console.error('❌ Not running in Electron or shell API not available');
    return;
  }

  console.log('✅ Electron shell API detected\n');

  // Test 1: Simple echo command
  console.log('Test 1: Echo command');
  try {
    const result1 = await window.electron.shell.exec('echo "Hello from real shell!"');
    console.log('stdout:', result1.stdout);
    console.log('stderr:', result1.stderr);
    console.log('exitCode:', result1.exitCode);
    console.log(result1.exitCode === 0 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
  }

  // Test 2: List files
  console.log('Test 2: List files');
  try {
    const listCmd = process.platform === 'win32' ? 'dir' : 'ls -la';
    const result2 = await window.electron.shell.exec(listCmd);
    console.log('stdout:', result2.stdout.substring(0, 200) + '...');
    console.log('exitCode:', result2.exitCode);
    console.log(result2.exitCode === 0 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
  }

  // Test 3: Check Node.js version
  console.log('Test 3: Node.js version');
  try {
    const result3 = await window.electron.shell.exec('node --version');
    console.log('stdout:', result3.stdout);
    console.log('exitCode:', result3.exitCode);
    console.log(result3.exitCode === 0 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
  }

  // Test 4: Error handling (non-existent command)
  console.log('Test 4: Non-existent command');
  try {
    const result4 = await window.electron.shell.exec('this-command-does-not-exist');
    console.log('stdout:', result4.stdout);
    console.log('stderr:', result4.stderr);
    console.log('exitCode:', result4.exitCode);
    console.log(result4.exitCode !== 0 ? '✅ PASS (expected failure)\n' : '❌ FAIL\n');
  } catch (error) {
    console.log('✅ PASS (error caught as expected)\n');
  }

  // Test 5: Working directory
  console.log('Test 5: Working directory');
  try {
    const pwdCmd = process.platform === 'win32' ? 'cd' : 'pwd';
    const result5 = await window.electron.shell.exec(pwdCmd);
    console.log('stdout:', result5.stdout);
    console.log('Should contain "shakespeare":', result5.stdout.includes('shakespeare'));
    console.log(result5.stdout.includes('shakespeare') ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
  }

  console.log('All tests completed!');
}

// Run the tests
testElectronShell();
