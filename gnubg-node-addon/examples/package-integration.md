# Integration with Existing Project

## Adding to Your Package

1. **Install the addon in your project:**
   ```bash
   npm install @nodots-llc/gnubg-hints
   ```

2. **Update your package.json dependencies:**
   ```json
   {
     "dependencies": {
       "@nodots-llc/gnubg-hints": "^1.0.0",
       "@nodots-llc/backgammon-types": "^1.0.0"
     }
   }
   ```

## Quick Integration Example

```typescript
// In your existing game service
import { GnuBgHints } from '@nodots-llc/gnubg-hints';
import type { BackgammonGame } from '@nodots-llc/backgammon-types';

export class GameService {
  private hintsInitialized = false;

  async initializeHints() {
    if (!this.hintsInitialized) {
      await GnuBgHints.initialize();
      GnuBgHints.configure({ evalPlies: 2, moveFilter: 2 });
      this.hintsInitialized = true;
    }
  }

  async getAIMove(game: BackgammonGame) {
    await this.initializeHints();

    if (game.state !== 'rolled' || !game.activePlay) {
      throw new Error('Game not ready for move');
    }

    const currentPlayer = game.players.find(p => p.color === game.turn);
    const opponent = game.players.find(p => p.color !== game.turn);

    const hints = await GnuBgHints.getMoveHints({
      board: game.board,
      dice: game.activePlay.dice,
      cubeValue: game.cube.value,
      cubeOwner: game.cube.owner,
      matchScore: [currentPlayer!.score, opponent!.score],
      matchLength: game.matchLength,
      crawford: game.isCrawford,
      jacoby: true,
      beavers: true
    }, 1);

    return hints[0]?.moves || [];
  }

  shutdown() {
    if (this.hintsInitialized) {
      GnuBgHints.shutdown();
      this.hintsInitialized = false;
    }
  }
}
```

## Using in API Routes (Express/Fastify)

```typescript
// api/routes/hints.ts
import { Router } from 'express';
import { GnuBgHints } from '@nodots-llc/gnubg-hints';

const router = Router();

// Initialize once when server starts
let initialized = false;

router.use(async (req, res, next) => {
  if (!initialized) {
    await GnuBgHints.initialize();
    initialized = true;
  }
  next();
});

router.post('/move-hints', async (req, res) => {
  try {
    const { board, dice, cubeValue, matchScore, matchLength } = req.body;

    const hints = await GnuBgHints.getMoveHints({
      board,
      dice,
      cubeValue,
      cubeOwner: null,
      matchScore,
      matchLength,
      crawford: false,
      jacoby: true,
      beavers: true
    }, 5);

    res.json({ hints });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/double-hint', async (req, res) => {
  try {
    const { board, cubeValue, matchScore, matchLength } = req.body;

    const hint = await GnuBgHints.getDoubleHint({
      board,
      dice: [0, 0],
      cubeValue,
      cubeOwner: null,
      matchScore,
      matchLength,
      crawford: false,
      jacoby: true,
      beavers: true
    });

    res.json({ hint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

## Using in React Components

```typescript
// components/HintButton.tsx
import React, { useState } from 'react';
import { GnuBgHints } from '@nodots-llc/gnubg-hints';
import type { BackgammonGame, BackgammonMove } from '@nodots-llc/backgammon-types';

interface HintButtonProps {
  game: BackgammonGame;
  onHintReceived: (moves: BackgammonMove[]) => void;
}

export const HintButton: React.FC<HintButtonProps> = ({ game, onHintReceived }) => {
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const getHint = async () => {
    setLoading(true);
    try {
      // Initialize on first use
      if (!initialized) {
        await GnuBgHints.initialize();
        setInitialized(true);
      }

      if (game.state === 'rolled' && game.activePlay) {
        const currentPlayer = game.players.find(p => p.color === game.turn);
        const opponent = game.players.find(p => p.color !== game.turn);

        const hints = await GnuBgHints.getMoveHints({
          board: game.board,
          dice: game.activePlay.dice,
          cubeValue: game.cube.value,
          cubeOwner: game.cube.owner,
          matchScore: [currentPlayer!.score, opponent!.score],
          matchLength: game.matchLength,
          crawford: game.isCrawford,
          jacoby: true,
          beavers: true
        }, 1);

        if (hints.length > 0) {
          onHintReceived(hints[0].moves);
        }
      }
    } catch (error) {
      console.error('Failed to get hint:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={getHint}
      disabled={loading || game.state !== 'rolled'}
      className="hint-button"
    >
      {loading ? 'Getting Hint...' : '💡 Hint'}
    </button>
  );
};
```

## Performance Best Practices

1. **Initialize Once**: Initialize the engine once per application lifecycle
2. **Reuse Instance**: Don't create multiple instances
3. **Proper Cleanup**: Call shutdown() when your application closes
4. **Error Handling**: Always wrap calls in try/catch blocks

```typescript
// Application lifecycle management
class Application {
  private hintsReady = false;

  async startup() {
    console.log('Initializing GNU BG hints...');
    await GnuBgHints.initialize();
    this.hintsReady = true;
    console.log('Hints ready!');
  }

  async shutdown() {
    if (this.hintsReady) {
      GnuBgHints.shutdown();
      this.hintsReady = false;
    }
  }

  isHintsReady() {
    return this.hintsReady;
  }
}

// In your main application
const app = new Application();

process.on('SIGINT', async () => {
  await app.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await app.shutdown();
  process.exit(0);
});
```

## Testing Integration

```typescript
// test setup
beforeAll(async () => {
  await GnuBgHints.initialize();
});

afterAll(() => {
  GnuBgHints.shutdown();
});

test('AI makes reasonable move', async () => {
  const game = createTestGame();
  const hints = await GnuBgHints.getMoveHints({
    board: game.board,
    dice: [6, 1],
    cubeValue: 1,
    cubeOwner: null,
    matchScore: [0, 0],
    matchLength: 7,
    crawford: false,
    jacoby: true,
    beavers: true
  }, 1);

  expect(hints).toHaveLength(1);
  expect(hints[0].moves).toBeDefined();
  expect(hints[0].equity).toBeTypeOf('number');
});
```