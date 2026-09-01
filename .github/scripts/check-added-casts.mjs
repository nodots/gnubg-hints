#!/usr/bin/env node
// House rule: every `as` cast explains itself. Scoped to lines the PR adds --
// development already carries pre-existing casts, and this check is not a
// licence to rewrite them.
//
// Usage: check-added-casts.mjs <base-ref> <head-sha>
import { execFileSync } from 'node:child_process'

const [base, head] = process.argv.slice(2)
if (!base || !head) {
  console.error('usage: check-added-casts.mjs <base-ref> <head-sha>')
  process.exit(2)
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// `as const` is not a type assertion and never needs justifying.
const CAST = /\bas\s+(?!const\b)(any\b|unknown\b|[A-Z][\w.]*)/
const COMMENT = /\/\/|\/\*|^\s*\*/

const files = git('diff', '--name-only', `${base}...${head}`, '--', '*.ts', '*.tsx')
  .split('\n')
  .filter(Boolean)

const offenders = []

for (const file of files) {
  // -U3 so an explanation on the preceding lines counts as justification.
  const diff = git('diff', '-U3', `${base}...${head}`, '--', file).split('\n')

  // Track the last two *rendered* lines (context or added) so a comment
  // block directly above the cast counts. Deliberately a heuristic: it
  // accepts one comment covering an adjacent pair of similar lines (the
  // bar-cw / bar-ccw shape), and correspondingly will not catch a cast
  // added two lines under an unrelated comment.
  let recent = []
  let lineNo = 0

  for (const raw of diff) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw)
    if (hunk) {
      lineNo = Number(hunk[1])
      recent = []
      continue
    }
    if (raw.startsWith('+++') || raw.startsWith('---')) continue
    if (raw.startsWith('-')) continue
    if (!/^[ +]/.test(raw)) continue

    const text = raw.slice(1)
    const added = raw.startsWith('+')

    if (added && CAST.test(text) && !COMMENT.test(text)) {
      const justified = recent.some((l) => COMMENT.test(l))
      if (!justified) offenders.push(`${file}:${lineNo}: ${text.trim()}`)
    }

    recent.push(text)
    if (recent.length > 2) recent.shift()
    lineNo++
  }
}

if (offenders.length) {
  console.error('Added `as` casts without an explaining comment:\n')
  for (const o of offenders) console.error('  ' + o)
  console.error(
    `\n${offenders.length} cast(s). Add a comment on or above each explaining why it is needed.`
  )
  process.exit(1)
}

console.log(`No unexplained casts in ${files.length} changed TypeScript file(s).`)
