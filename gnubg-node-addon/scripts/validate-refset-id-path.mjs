#!/usr/bin/env node
/**
 * Issue #36 acceptance: run the gnubg 2-ply reference set through the
 * POSITION-ID hint path and compare each rank-1 answer against the refset's
 * board-path oracle.
 *
 * The refset's ids are ON-ROLL-FIRST (the protocol-adapter dialect, pinned by
 * backgammon-neural's positionId-convention test). This addon speaks the GNU
 * standard (opponent first), so each refset id is re-encoded before it is fed
 * to the id path: decode the raw sides, swap the mover into TanBoard[1], and
 * re-encode with the addon's own encoder. A decoder aligned to the wrong
 * dialect fails this run in bulk.
 *
 * Usage: node scripts/validate-refset-id-path.mjs [path-to-refset.json]
 * Exits non-zero on any mismatch.
 */
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { GnuBgHints } = require('../dist/index.js')
const native = require('../build/Release/gnubg_hints.node')

const DEFAULT_REFSET = fileURLToPath(
  new URL(
    '../../../backgammon-neural/data/reference/gnubg-2ply-refset.json',
    import.meta.url
  )
)

const refsetPath = process.argv[2] ?? DEFAULT_REFSET
if (!existsSync(refsetPath)) {
  console.error(`refset not found: ${refsetPath}`)
  console.error('pass the path to gnubg-2ply-refset.json as the first argument')
  process.exit(2)
}

const refset = JSON.parse(readFileSync(refsetPath, 'utf8'))
const decisions = refset.decisions
const ply = refset._meta?.ply ?? 2

const getMoveHints = (request, maxHints) =>
  new Promise((resolve, reject) => {
    native.getMoveHints(request, maxHints, (err, hints) =>
      err ? reject(err) : resolve(hints)
    )
  })

/** Raw gnubg steps are 0-based, bar=24, off=-1; the refset is 1-based, off=0. */
const stepKey = (from, to) => `${from}>${to}`
const rawSteps = (moves) => {
  const flat = Array.isArray(moves?.[0]) ? moves.flat() : moves
  const keys = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const from = flat[i]
    const to = flat[i + 1]
    if (!Number.isFinite(from) || from < 0) break
    keys.push(stepKey(from === 24 ? 25 : from + 1, to < 0 ? 0 : to + 1))
  }
  return keys.sort()
}
const refSteps = (moves) => moves.map((m) => stepKey(m.from, m.to)).sort()

await GnuBgHints.initialize()
GnuBgHints.configure({ evalPlies: ply })

let matched = 0
const mismatches = []
const byCategory = new Map()

for (const d of decisions) {
  // Refset dialect: first side = mover. GNU TanBoard: mover = board[1].
  const sides = native.decodePositionId(d.positionId)
  const gnuId = native.getPositionId([sides[1], sides[0]])

  const hints = await getMoveHints(
    {
      positionId: gnuId,
      dice: d.dice,
      cubeValue: d.cubeValue,
      cubeOwner: d.cubeOwner === null ? -1 : d.cubeOwner,
      matchScore: d.matchScore,
      matchLength: d.matchLength,
      crawford: d.crawford,
      jacoby: d.jacoby,
      beavers: d.beavers,
    },
    1
  )

  const got = hints?.length ? rawSteps(hints[0].moves) : []
  const want = refSteps(d.candidates[0].moves)
  const ok = got.length === want.length && got.every((k, i) => k === want[i])

  const cat = byCategory.get(d.category) ?? { total: 0, matched: 0 }
  cat.total += 1
  if (ok) {
    matched += 1
    cat.matched += 1
  } else {
    mismatches.push({ id: d.id, dice: d.dice, want, got })
  }
  byCategory.set(d.category, cat)
}

console.log(`refset: ${refsetPath}`)
console.log(`id-path rank-1 match: ${matched}/${decisions.length} @ ${ply}-ply`)
for (const [cat, { total, matched: m }] of byCategory) {
  console.log(`  ${cat}: ${m}/${total}`)
}
for (const mm of mismatches.slice(0, 20)) {
  console.log(
    `MISMATCH ${mm.id} dice=${mm.dice} want=[${mm.want}] got=[${mm.got}]`
  )
}
if (mismatches.length > 20) {
  console.log(`… and ${mismatches.length - 20} more`)
}

GnuBgHints.shutdown()
process.exit(mismatches.length === 0 ? 0 : 1)
