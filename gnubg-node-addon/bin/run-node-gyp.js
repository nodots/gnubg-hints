#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ensureNodeGypBin = require('./ensure-node-gyp-bin');

try {
  ensureNodeGypBin();
} catch (error) {
  console.warn('Unable to ensure local node-gyp binary before execution:', error);
}

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

const NODE_VERSION = process.versions.node.replace(/^v/, '');

const nodeGypScript = resolveNodeGyp();

if (nodeGypScript) {
  console.log(`[run-node-gyp] Using node-gyp from ${nodeGypScript}`);
}

if (!nodeGypScript) {
  console.error('Unable to locate node-gyp. Ensure it is installed or expose it via npm_config_node_gyp.');
  process.exit(1);
}

const args = process.argv.slice(2);
const [command] = args;

function hasHeaders(candidate) {
  if (!candidate) {
    return false;
  }

  return exists(path.join(candidate, 'include', 'node', 'common.gypi'));
}

function resolveHeadersFromEnv() {
  const { npm_config_nodedir: envNodeDir } = process.env;
  return hasHeaders(envNodeDir) ? envNodeDir : null;
}

function resolveHeadersFromDevDir() {
  const devDir = process.env.npm_config_devdir;
  if (!devDir) {
    return null;
  }

  const candidate = path.join(devDir, NODE_VERSION);
  return hasHeaders(candidate) ? candidate : null;
}

function determineBundledHeaders() {
  const bundled = findBundledNodeDir();
  return hasHeaders(bundled) ? bundled : null;
}

function resolveHeaders() {
  return (
    resolveHeadersFromEnv() ||
    resolveHeadersFromDevDir() ||
    determineBundledHeaders()
  );
}

function ensureDevDir() {
  if (!process.env.npm_config_devdir) {
    process.env.npm_config_devdir = path.join(__dirname, '..', '.node-gyp');
  }

  try {
    fs.mkdirSync(process.env.npm_config_devdir, { recursive: true });
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error;
    }
  }
}

function runNodeGyp(commandArgs) {
  return spawnSync(process.execPath, [nodeGypScript, ...commandArgs], {
    stdio: 'inherit',
  });
}

function installHeaders({ ensure = true, extraArgs = [] } = {}) {
  const installArgs = ['install'];
  if (ensure) {
    installArgs.push('--ensure');
  }
  installArgs.push(...extraArgs);
  const result = runNodeGyp(installArgs);

  if (result.status && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
}

function removeStaleDevHeaders() {
  const devDir = process.env.npm_config_devdir;
  if (!devDir) {
    return;
  }

  const versionDir = path.join(devDir, NODE_VERSION);
  if (!exists(versionDir)) {
    return;
  }

  try {
    fs.rmSync(versionDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Unable to clear stale headers at ${versionDir}:`, error);
  }
}

function ensureHeaders() {
  let headerDir = resolveHeaders();
  if (headerDir) {
    process.env.npm_config_nodedir = headerDir;
    return;
  }

  ensureDevDir();
  installHeaders();

  headerDir = resolveHeaders();
  if (headerDir) {
    process.env.npm_config_nodedir = headerDir;
    return;
  }

  removeStaleDevHeaders();
  installHeaders({ ensure: false });

  headerDir = resolveHeaders();
  if (headerDir) {
    process.env.npm_config_nodedir = headerDir;
    return;
  }

  console.error('Unable to locate Node headers after running node-gyp install.');
  console.error('You may need to set npm_config_nodedir to your Node.js installation manually.');
  process.exit(1);
}

if (command === 'build' || command === 'rebuild') {
  ensureHeaders();
}

const result = runNodeGyp(args);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 0);
