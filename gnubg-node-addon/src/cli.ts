#!/usr/bin/env node

import { GnuBgHints, MoveHint, MoveStep } from './index';

const usage = `Usage: gnubg-hints-cli <position-id> <dice>

Examples:
  gnubg-hints-cli 4HPwATDgc/ABMA 3 1
  gnubg-hints-cli 4HPwATDgc/ABMA [3,1]
  gnubg-hints-cli 4HPwATDgc/ABMA 3,1
`;

function parseDice(rawArgs: string[]): [number, number] | null {
  const normalized = rawArgs
    .join(' ')
    .replace(/[\[\]]/g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(value => Number.parseInt(value, 10));

  if (normalized.length !== 2 || normalized.some(num => Number.isNaN(num))) {
    return null;
  }

  return [normalized[0], normalized[1]];
}

function formatMoveStep(step: MoveStep): string {
  const formatPoint = (point: number, container: MoveStep['fromContainer'] | MoveStep['toContainer']): string => {
    switch (container) {
      case 'bar':
        return 'bar';
      case 'off':
        return 'off';
      default:
        return point.toString();
    }
  };

  const descriptor = `${formatPoint(step.from, step.fromContainer)}→${formatPoint(step.to, step.toContainer)}`;
  return step.isHit ? `${descriptor}*` : descriptor;
}

function renderHint(hint: MoveHint): string {
  const moves = hint.moves.map(formatMoveStep).join(' ');
  const diff = hint.difference;
  const formattedDiff = diff === 0 ? '+0.000' : `${diff >= 0 ? '+' : ''}${diff.toFixed(3)}`;
  const evalSummary = hint.evaluation
    ? `win ${hint.evaluation.win.toFixed(3)}, gammon ${hint.evaluation.winGammon.toFixed(3)}`
    : 'evaluation unavailable';

  return [
    `#${hint.rank}: ${moves || '(no moves)'}`,
    `    equity ${hint.equity.toFixed(3)} (${formattedDiff})`,
    `    ${evalSummary}`
  ].join('\n');
}

async function main(): Promise<void> {
  const [positionId, ...diceArgs] = process.argv.slice(2);

  if (!positionId) {
    console.error('Error: missing GNU Backgammon position ID.');
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  const dice = parseDice(diceArgs);

  if (!dice) {
    console.error('Error: missing or invalid dice.');
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  try {
    await GnuBgHints.initialize();
    const hints = await GnuBgHints.getHintsFromPositionId(positionId, dice, 5);

    if (!hints.length) {
      console.log('No moves available for the provided position.');
      return;
    }

    hints.forEach(hint => {
      console.log(renderHint(hint));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to evaluate hints: ${message}`);
    process.exitCode = 1;
  } finally {
    GnuBgHints.shutdown();
  }
}

void main();
