// Verify fMoveOverride against hand-derived ground truth.
// Run from gnubg-node-addon/.
//
// Anchors:
//  A) Dead race, money, cube 2 owned by white. Taker = black (~30% win).
//     fMoveOverride=1 + activePlayer=black(taker) → must answer for the
//     taker: taking at cube 2 loses ~1.9 → action "drop".
//  B) Locked favorite: AI(ccw/black) closed home; human(white) 15 on bar.
//     Resigner = white(human), on roll. fMoveOverride=1 +
//     activePlayer=white(resigner) → resignedPoints should be ≥ 2
//     (human loses a gammon ~always).
//  C) Same as B but sanity: equityBefore should be strongly negative
//     (resigner is dead lost).

const { GnuBgHints } = require('./dist/index.js');
const path = require('path');

(async () => {
  await GnuBgHints.initialize({ weightsPath: path.join(__dirname, 'gnubg.wd') });

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
  const check = (name, cond, extra) => {
    total++;
    if (cond) pass++;
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

  // ── B/C) resign hint with explicit resigner seat ─────────────────────
  // Locked favorite: AI closed home keys-as-declared below; human on bar.
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
    'locked favorite resigner-seat: no resignation (favorite)',
    hB.resignedPoints === 0,
    `got resignedPoints=${hB.resignedPoints}, equityBefore=${hB.equityBefore?.toFixed(3)}`
  );

  // Hopeless: AI dead lost on bar equivalent — resigner concedes a lot.
  // Board mirrored: human closed home, AI 15 on bar. Resigner = AI(black).
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
  });
  check(
    'hopeless resigner-seat: concedes backgammon/gammon',
    hC.resignedPoints >= 2,
    `got resignedPoints=${hC.resignedPoints}, equityBefore=${hC.equityBefore?.toFixed(3)}`
  );

  console.log(`\n${pass}/${total} anchors matched`);
})().catch((e) => console.error('ERR', e.message));
