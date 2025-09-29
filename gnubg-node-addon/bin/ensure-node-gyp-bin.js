#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function ensureNodeGypBin() {
  const packageRoot = path.resolve(__dirname, '..');
  let nodeGypEntry;
  try {
    nodeGypEntry = require.resolve('node-gyp/bin/node-gyp.js', { paths: [packageRoot] });
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      return;
    }

    throw error;
  }

  const binDir = path.join(packageRoot, 'node_modules', '.bin');
  const binPath = path.join(binDir, 'node-gyp');
  const relativeEntry = path.relative(binDir, nodeGypEntry).replace(/\\/g, '/');
  const proxySource = `#!/usr/bin/env node\nrequire(${JSON.stringify(relativeEntry)});\n`;

  try {
    const currentStat = fs.lstatSync(binPath);
    if (currentStat.isSymbolicLink() || currentStat.isFile()) {
      const currentContent = currentStat.isSymbolicLink()
        ? null
        : fs.readFileSync(binPath, 'utf8');
      if (currentContent === proxySource) {
        return;
      }

      fs.unlinkSync(binPath);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(binPath, proxySource, { mode: 0o755 });
  fs.chmodSync(binPath, 0o755);
}

function run() {
  try {
    ensureNodeGypBin();
  } catch (error) {
    console.warn('Unable to ensure local node-gyp binary:', error);
  }
}

module.exports = ensureNodeGypBin;

if (require.main === module) {
  run();
}
