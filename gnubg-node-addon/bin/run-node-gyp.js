#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function resolveNodeGyp() {
  const local = path.join(__dirname, '..', 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');
  if (fs.existsSync(local)) {
    return local;
  }

  const npmConfigNodeGyp = process.env.npm_config_node_gyp;
  if (npmConfigNodeGyp && fs.existsSync(npmConfigNodeGyp)) {
    return npmConfigNodeGyp;
  }

  try {
    return require.resolve('node-gyp/bin/node-gyp.js');
  } catch (error) {
    console.error('Unable to locate node-gyp. Ensure node-gyp is installed or available via npm_config_node_gyp.');
    console.error(error);
    process.exit(1);
  }
}

const nodeGypScript = resolveNodeGyp();
const args = process.argv.slice(2);
const [command] = args;

function runNodeGyp(commandArgs) {
  return spawnSync(process.execPath, [nodeGypScript, ...commandArgs], {
    stdio: 'inherit',
  });
}

if (command === 'build' || command === 'rebuild') {
  const installResult = runNodeGyp(['install', '--ensure']);
  if (installResult.status !== 0) {
    process.exit(installResult.status ?? 1);
  }
}

const result = runNodeGyp(args);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
