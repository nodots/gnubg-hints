#!/usr/bin/env node
// nodots/gnubg-hints#39 and #40 sat open for a week on the same commit under
// two branch names, splitting the review across both. The general shape is a
// follow-up branched off a feature branch instead of the base, which
// re-proposes its parent's whole diff.
//
// Fails when this PR shares commits with another open PR.
//
// Usage: check-overlapping-prs.mjs <repo> <pr-number>
// Env:   GH_TOKEN (required), PR_STATE (default "open"; "all" for testing)
import { execFileSync } from 'node:child_process'

const [repo, prNumber] = process.argv.slice(2)
if (!repo || !prNumber) {
  console.error('usage: check-overlapping-prs.mjs <owner/repo> <pr-number>')
  process.exit(2)
}
const state = process.env.PR_STATE || 'open'

const api = (path, jq) =>
  execFileSync('gh', ['api', path, '--paginate', '--jq', jq], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter(Boolean)

const commitsOf = (n) => new Set(api(`repos/${repo}/pulls/${n}/commits`, '.[].sha'))

const self = Number(prNumber)
const selfCommits = commitsOf(self)
const selfHead = api(`repos/${repo}/pulls/${self}`, '.head.sha')[0]

const others = api(
  `repos/${repo}/pulls?state=${state}&per_page=100`,
  '.[] | "\\(.number) \\(.head.sha) \\(.head.ref)"'
)
  .map((l) => {
    const [number, sha, ...ref] = l.split(' ')
    return { number: Number(number), sha, ref: ref.join(' ') }
  })
  .filter((p) => p.number !== self)

const duplicates = []
const stacked = []

for (const other of others) {
  if (other.sha === selfHead) {
    duplicates.push(other)
    continue
  }
  const shared = [...commitsOf(other.number)].filter((s) => selfCommits.has(s))
  if (shared.length) stacked.push({ ...other, shared })
}

for (const d of duplicates) {
  console.error(
    `::error::PR #${d.number} (${d.ref}) has the same head commit ${selfHead}. ` +
      `Two PRs for one commit -- close all but one.`
  )
}
for (const s of stacked) {
  console.error(
    `::error::shares ${s.shared.length} commit(s) with PR #${s.number} (${s.ref}), ` +
      `e.g. ${s.shared[0].slice(0, 8)}. Branch a follow-up from the base, or push it ` +
      `to the reviewed branch as new commits.`
  )
}

if (duplicates.length || stacked.length) process.exit(1)
console.log(`No commit overlap with ${others.length} other ${state} PR(s).`)
