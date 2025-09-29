#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function exists(filePath) {
  return Boolean(filePath && fs.existsSync(filePath));
}

function resolveFromEnv() {
  const candidate = process.env.npm_config_node_gyp;
  if (!candidate) {
    return null;
  }

  const resolved = path.isAbsolute(candidate)
    ? candidate
    : path.resolve(process.cwd(), candidate);

  return exists(resolved) ? resolved : null;
}

function resolveFromLocalNodeModules() {
  let current = __dirname;

  while (true) {
    const candidate = path.join(current, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');
    if (exists(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function resolveViaRequire() {
  try {
    return require.resolve('node-gyp/bin/node-gyp.js');
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
  }

  return null;
}

function resolveNodeGyp() {
  return (
    resolveFromLocalNodeModules() ||
    resolveFromEnv() ||
    resolveViaRequire()
  );
}

function findBundledNodeDir() {
  if (process.env.npm_config_nodedir) {
    return null;
  }

  const execDir = path.dirname(process.execPath);
  const candidates = new Set([
    path.resolve(execDir, '..'),
    path.resolve(execDir, '..', '..'),
  ]);

  for (const candidate of candidates) {
    if (!candidate || candidate === path.sep) {
      continue;
    }

    const includeDir = path.join(candidate, 'include', 'node', 'common.gypi');
    if (exists(includeDir)) {
      return candidate;
    }
  }

  return null;
}

const nodeGypScript = resolveNodeGyp();

if (!nodeGypScript) {
  console.error('Unable to locate node-gyp. Ensure it is installed or expose it via npm_config_node_gyp.');
  process.exit(1);
}

const args = process.argv.slice(2);
const [command] = args;

const bundledNodeDir = findBundledNodeDir();
if (bundledNodeDir) {
  process.env.npm_config_nodedir = bundledNodeDir;
}

function runNodeGyp(commandArgs) {
  return spawnSync(process.execPath, [nodeGypScript, ...commandArgs], {
    stdio: 'inherit',
  });
}

function ensureHeaders() {
  const result = runNodeGyp(['install', '--ensure']);
  if (result.status && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
}

if (command === 'build' || command === 'rebuild') {
  ensureHeaders();
}

const result = runNodeGyp(args);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 0);
