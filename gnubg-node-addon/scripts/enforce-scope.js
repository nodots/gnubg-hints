#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { minimatch } = require('minimatch');

const scopePath = path.resolve(process.cwd(), 'SCOPE.json');

// No scope manifest = no restriction (main branch, hotfix, etc.)
if (!fs.existsSync(scopePath)) process.exit(0);

const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

// SCOPE.json itself is always allowed
const violations = staged.filter(file => {
  if (file === 'SCOPE.json') return false;
  if (file === 'BLOCKER.md') return false;
  if (file === 'HANDOFF.md') return false;

  const allowed = scope.allowedPaths.length > 0 &&
    scope.allowedPaths.some(pattern => minimatch(file, pattern));
  const forbidden = scope.forbiddenPaths.some(pattern => minimatch(file, pattern));

  return !allowed || forbidden;
});

if (violations.length > 0) {
  console.error('\n❌ Scope violation — files outside SCOPE.json allowedPaths:\n');
  violations.forEach(f => console.error(`  ${f}`));
  console.error('\nUpdate SCOPE.json or move changes to the correct branch.\n');
  process.exit(1);
}

console.log('✅ Scope check passed');
process.exit(0);
