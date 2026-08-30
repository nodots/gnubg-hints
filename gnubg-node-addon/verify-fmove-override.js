// Verify fMoveOverride against hand-derived ground truth.
// Run from gnubg-node-addon/.
//
// Anchors:
//  A) Dead race, money, cube 2 owned by white. Taker = black (~30% win).
//     fMoveOverride=1 + activePlayer=black(taker) → must answer for the
//     taker: taking at cube 2 loses ~1.9 → action "drop".
//  B) Closed-out contact position: white 15 on bar vs black's closed home.
//     Resigner = white(human), on roll. contact (CLASS_CONTACT) is gated
//     OUT of auto-resign by the CLASS_RACE gate (play.c:1265), so the hint
//     must short-circuit to resignedPoints === 0 — not 0-by-convention but
//     because the position class is above CLASS_RACE.
//  C) Same as B but offered-path: gnubg's verdict for a full backgammon
//     concession from a dead-lost resigner must ACCEPT (decision === true,
//     rEqAfter −3 < rEqBefore). Not gated — the offered path stays ungated.

const { GnuBgHints } = require('./dist/index.js');
const path = require('path');

(async () => {
  // initialize() takes the weights PATH (string), not an options object.
  await GnuBgHints.initialize(path.join(__dirname, 'gnubg.wd'));

  function nodotsBoard(spec) {
    const points = [];
    for (let p = 1; p <= 24; p++) {
      const entry = spec.points[p];
      const checkers = [];
      if (entry) {
        const [color, count] = entry;
        for (let i = 0; i < count; i++) {
          checkers.push({
            id: `c${p}${color}${i}`,
            color: color === 'w' ? 'white' : 'black',
          });
        }
      }
      points.push({
        id: `p${p}`,
        position: { clockwise: p, counterclockwise: 25 - p },
        checkers,
      });
    }
    const cwBar = [];
    for (let i = 0; i < (spec.bar.white || 0); i++) {
      cwBar.push({ id: `bw${i}`, color: 'white' });
    }
    const ccwBar = [];
    for (let i = 0; i < (spec.bar.black || 0); i++) {
      ccwBar.push({ id: `bb${i}`, color: 'black' });
    }
    return {
      id: 'b',
      points,
      bar: {
        clockwise: { id: 'bc', checkers: cwBar },
        counterclockwise: { id: 'bcc', checkers: ccwBar },
      },
      off: {
        clockwise: { id: 'oc', checkers: [] },
        counterclockwise: { id: 'occ', checkers: [] },
      },
    };
  }

  let pass = 0;
  let total = 0;
  let failed = 0;
  const check = (name, cond, extra) => {
    total++;
    if (cond) pass++;
    else failed++;
    console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  };

  // ── A) take hint with explicit taker seat ────────────────────────────
  // Dead race: black on its 8pt (~120 pips), white ahead (~75). Taker=black.
  const deadRace = nodotsBoard({ points: { 8: ['b', 15], 17: ['w', 15] }, bar: {} });
  const hA = await GnuBgHints.getTakeHint({
    board: deadRace,
    dice: [3, 1],
    cubeValue: 2,
    cubeOwner: 'white',
    activePlayerColor: 'black',
    activePlayerDirection: 'counterclockwise',
    matchScore: [0, 0],
    matchLength: 0,
    crawford: false,
    jacoby: false,
    beavers: true,
    fMoveOverride: 1,
  });
  check(
    'dead race taker-seat: drop',
    hA.action === 'drop',
    `got ${hA.action} (takeEquity=${hA.takeEquity?.toFixed(3)}, dropEquity=${hA.dropEquity?.toFixed(3)})`
  );

  // ── B) resign hint: CLASS_CONTACT short-circuits to 0 ────────────────
  // Resigner = white (15 on bar), AI's home closed → CLASS_CONTACT. The
  // CLASS_RACE gate (play.c:1265) excludes contact/crashed positions from
  // auto-resign, so the hint MUST return resignedPoints === 0 (not a gammon).
  const lockedFav = nodotsBoard({
    points: {
      6: ['b', 2], 5: ['b', 2], 4: ['b', 2], 3: ['b', 2],
      2: ['b', 2], 1: ['b', 2], 7: ['b', 3],
    },
    bar: { white: 15 },
  });
  const hB = await GnuBgHints.getResignHint({
    board: lockedFav,
    dice: [3, 1],
    cubeValue: 1,
    cubeOwner: null,
    activePlayerColor: 'white',
    activePlayerDirection: 'clockwise',
    matchScore: [0, 0],
    matchLength: 0,
    crawford: false,
    jacoby: false,
    beavers: true,
    fMoveOverride: 1,
  });
  check(
    'resigner-seat contact position: gated OUT (resignedPoints === 0)',
    hB.resignedPoints === 0,
    `got resignedPoints=${hB.resignedPoints}, equityBefore=${hB.equityBefore?.toFixed(3)}`
  );

  // ── C) offered resignation: gnubg's accept/reject verdict (decision) ──
  // Resigner (black) dead-lost on the bar; white has a closed home. A full
  // backgammon concession is offered → gnubg ACCEPTS (decision === true,
  // rEqAfter −3 < rEqBefore). The offered path is NOT gated.
  const hopelessForBlack = nodotsBoard({
    points: {
      19: ['w', 2], 20: ['w', 2], 21: ['w', 2], 22: ['w', 2],
      23: ['w', 2], 24: ['w', 2], 18: ['w', 3],
    },
    bar: { black: 15 },
  });
  const hC = await GnuBgHints.getResignHint({
    board: hopelessForBlack,
    dice: [3, 1],
    cubeValue: 1,
    cubeOwner: null,
    activePlayerColor: 'black',
    activePlayerDirection: 'counterclockwise',
    matchScore: [0, 0],
    matchLength: 0,
    crawford: false,
    jacoby: false,
    beavers: true,
    fMoveOverride: 1,
    offeredPoints: 3,
  });
  check(
    'offered backgammon concession (dead-lost resigner): ACCEPTED',
    hC.hasDecision === true && hC.decision === true,
    `got decision=${hC.decision}, hasDecision=${hC.hasDecision}, equityBefore=${hC.equityBefore?.toFixed(3)}, equityAfter=${hC.equityAfter?.toFixed(3)}`
  );

  // Mirror: offered resignation pin — the C-side rule matches the epsilon
  // contract (equityAfter - 1e-6 < equityBefore === accept).
  const winningResigner = nodotsBoard({
    points: {
      6: ['b', 2], 5: ['b', 2], 4: ['b', 2], 3: ['b', 2],
      2: ['b', 2], 1: ['b', 2], 7: ['b', 3],
    },
    bar: { white: 15 },
  });
  const hD = await GnuBgHints.getResignHint({
    board: winningResigner,
    dice: [3, 1],
    cubeValue: 1,
    cubeOwner: null,
    activePlayerColor: 'white',
    activePlayerDirection: 'clockwise',
    matchScore: [0, 0],
    matchLength: 0,
    crawford: false,
    jacoby: false,
    beavers: true,
    fMoveOverride: 1,
    offeredPoints: 3,
  });
  check(
    'offered resignation: decision mirrors epsilon rule',
    hD.hasDecision === true && hD.decision === (hD.equityAfter - 1e-6 < hD.equityBefore),
    `got decision=${hD.decision}, hasDecision=${hD.hasDecision}, equityBefore=${hD.equityBefore?.toFixed(3)}, equityAfter=${hD.equityAfter?.toFixed(3)}`
  );

  console.log(`\n${pass}/${total} anchors matched` + (failed ? ` — ${failed} FAILED` : ''));
  if (failed) process.exitCode = 1;
})().catch((e) => console.error('ERR', e.message));
