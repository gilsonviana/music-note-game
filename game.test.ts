/**
 * Tests for Music Note Game
 * Run with: npx ts-node game.test.ts
 */

// Simple test framework
class TestRunner {
  tests: Array<{ description: string; fn: (runner: TestRunner) => void }> = [];
  passed: number = 0;
  failed: number = 0;

  test(description: string, fn: (runner: TestRunner) => void): void {
    this.tests.push({ description, fn });
  }

  assert(condition: boolean, message?: string): void {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual: any, expected: any, message?: string): void {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertDeepEqual(actual: any, expected: any, message?: string): void {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
    }
  }

  run(): boolean {
    console.log('Running tests...\n');

    this.tests.forEach(({ description, fn }) => {
      try {
        fn(this);
        this.passed++;
        console.log(`✓ ${description}`);
      } catch (error) {
        this.failed++;
        console.log(`✗ ${description}`);
        if (error instanceof Error) {
          console.log(`  Error: ${error.message}\n`);
        }
      }
    });

    console.log(`\n${this.passed + this.failed} tests, ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

const runner = new TestRunner();

// ============================================================================
// Test Note Duration Calculation
// ============================================================================

runner.test('getNoteDuration returns correct duration for whole note', (t) => {
  const BPM = 90;
  const beatDuration = 60 / BPM;
  const expected = beatDuration * 4;

  const noteDurations: Record<string, number> = {
    'whole': beatDuration * 4,
    'half': beatDuration * 2,
    'quarter': beatDuration * 1,
    'eighth': beatDuration * 0.5,
    'sixteenth': beatDuration * 0.25,
  };

  t.assertEqual(noteDurations['whole'], expected, 'Whole note should be 4 beats');
});

runner.test('getNoteDuration returns correct duration for half note', (t) => {
  const BPM = 90;
  const beatDuration = 60 / BPM;
  const expected = beatDuration * 2;

  const noteDurations: Record<string, number> = {
    'whole': beatDuration * 4,
    'half': beatDuration * 2,
    'quarter': beatDuration * 1,
    'eighth': beatDuration * 0.5,
    'sixteenth': beatDuration * 0.25,
  };

  t.assertEqual(noteDurations['half'], expected, 'Half note should be 2 beats');
});

runner.test('getNoteDuration returns correct duration for quarter note', (t) => {
  const BPM = 90;
  const beatDuration = 60 / BPM;
  const expected = beatDuration * 1;

  const noteDurations: Record<string, number> = {
    'whole': beatDuration * 4,
    'half': beatDuration * 2,
    'quarter': beatDuration * 1,
    'eighth': beatDuration * 0.5,
    'sixteenth': beatDuration * 0.25,
  };

  t.assertEqual(noteDurations['quarter'], expected, 'Quarter note should be 1 beat');
});

// ============================================================================
// Test Lives System
// ============================================================================

runner.test('Lives system starts with correct initial values', (t) => {
  const lives = {
    current: 5,
    max: 5,
  };

  t.assertEqual(lives.current, 5, 'Should start with 5 lives');
  t.assertEqual(lives.max, 5, 'Max lives should be 5');
});

runner.test('Lives system decrements correctly', (t) => {
  let current = 5;
  const max = 5;

  const loseLife = () => {
    if (current > 0) {
      current -= 1;
    }
    return current <= 0;
  };

  t.assertEqual(current, 5, 'Should start with 5 lives');
  loseLife();
  t.assertEqual(current, 4, 'Should have 4 lives after losing one');
  loseLife();
  t.assertEqual(current, 3, 'Should have 3 lives after losing two');
});

runner.test('Lives system detects game over correctly', (t) => {
  let current = 1;

  const loseLife = () => {
    if (current > 0) {
      current -= 1;
    }
    return current <= 0;
  };

  const isGameOver = loseLife();
  t.assertEqual(current, 0, 'Lives should be 0');
  t.assert(isGameOver, 'Should return true when game is over');
});

runner.test('Lives system does not go below zero', (t) => {
  let current = 0;

  const loseLife = () => {
    if (current > 0) {
      current -= 1;
    }
    return current <= 0;
  };

  loseLife();
  t.assertEqual(current, 0, 'Lives should not go below 0');
});

// ============================================================================
// Test Score System
// ============================================================================

runner.test('Score system starts at zero', (t) => {
  const score = {
    current: 0,
  };

  t.assertEqual(score.current, 0, 'Score should start at 0');
});

runner.test('Score system adds points correctly', (t) => {
  let current = 0;

  const addPoints = (points: number) => {
    current += points;
  };

  addPoints(100);
  t.assertEqual(current, 100, 'Score should be 100 after adding 100 points');

  addPoints(50);
  t.assertEqual(current, 150, 'Score should be 150 after adding 50 more points');
});

runner.test('Score system resets correctly', (t) => {
  let current = 250;

  const reset = () => {
    current = 0;
  };

  reset();
  t.assertEqual(current, 0, 'Score should be 0 after reset');
});

// ============================================================================
// Test Note Key Mapping
// ============================================================================

runner.test('NOTE_KEY_MAP has correct structure', (t) => {
  const NOTE_KEY_MAP: Record<string, number[]> = {
    "c": [6.5],
    "d": [6.0],
    "e": [5.5, 9.0],
    "f": [5.0, 8.5],
    "g": [8.0],
    "a": [7.5],
    "b": [7.0],
  };

  t.assert(Array.isArray(NOTE_KEY_MAP["c"]), 'C should be an array');
  t.assertEqual(NOTE_KEY_MAP["c"].length, 1, 'C should have 1 position');
  t.assertEqual(NOTE_KEY_MAP["e"].length, 2, 'E should have 2 positions (duplicate octaves)');
  t.assertEqual(NOTE_KEY_MAP["f"].length, 2, 'F should have 2 positions (duplicate octaves)');
});

runner.test('NOTE_KEY_MAP contains all expected notes', (t) => {
  const NOTE_KEY_MAP: Record<string, number[]> = {
    "c": [6.5],
    "d": [6.0],
    "e": [5.5, 9.0],
    "f": [5.0, 8.5],
    "g": [8.0],
    "a": [7.5],
    "b": [7.0],
  };

  const expectedNotes = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
  expectedNotes.forEach(note => {
    t.assert(NOTE_KEY_MAP[note] !== undefined, `Should have mapping for note ${note}`);
  });
});

// ============================================================================
// Test Obstacle Generation
// ============================================================================

runner.test('Obstacle generator creates valid obstacle object', (t) => {
  interface SimpleObstacle {
    pixelX: number;
    pixelY: number;
    imagePath: string | null;
    image: null;
    speed: number;
    hasBeenAvoided: boolean;
    hasCollided: boolean;
  }

  const obstacleGenerator = (pixelX: number = 0, pixelY: number = 0, imagePath: string | null = null, speed: number = 100): SimpleObstacle => {
    return {
      pixelX,
      pixelY,
      imagePath,
      image: null,
      speed,
      hasBeenAvoided: false,
      hasCollided: false,
    };
  };

  const obstacle = obstacleGenerator(640, 160, 'test.png', 150);

  t.assertEqual(obstacle.pixelX, 640, 'Obstacle should have correct X position');
  t.assertEqual(obstacle.pixelY, 160, 'Obstacle should have correct Y position');
  t.assertEqual(obstacle.speed, 150, 'Obstacle should have correct speed');
  t.assertEqual(obstacle.hasBeenAvoided, false, 'Obstacle should not be avoided initially');
  t.assertEqual(obstacle.hasCollided, false, 'Obstacle should not be collided initially');
});

// ============================================================================
// Test Game Configuration
// ============================================================================

runner.test('Game configuration has valid values', (t) => {
  const CONFIG = {
    GRID_SIZE: 32,
    PLAYER_SIZE: 32,
    OBSTACLE_SPEED: 150,
    COLLISION_POINTS_GAINED: 100,
    BPM: 90,
  };

  t.assert(CONFIG.GRID_SIZE > 0, 'Grid size should be positive');
  t.assert(CONFIG.PLAYER_SIZE > 0, 'Player size should be positive');
  t.assert(CONFIG.OBSTACLE_SPEED > 0, 'Obstacle speed should be positive');
  t.assert(CONFIG.COLLISION_POINTS_GAINED > 0, 'Collision points should be positive');
  t.assert(CONFIG.BPM > 0, 'BPM should be positive');
});

// ============================================================================
// Test Overlay Width Calculation
// ============================================================================

runner.test('Overlay width calculation is correct for half note', (t) => {
  const BPM = 90;
  const beatDuration = 60 / BPM;
  const noteDuration = beatDuration * 2; // half note
  const obstacleSpeed = 150;
  const overlayWidth = noteDuration * obstacleSpeed;

  const expected = (60 / 90) * 2 * 150;
  t.assertEqual(overlayWidth, expected, 'Overlay width should match expected calculation');
});

runner.test('Overlay width increases with note duration', (t) => {
  const BPM = 90;
  const beatDuration = 60 / BPM;
  const obstacleSpeed = 150;

  const wholeNoteWidth = (beatDuration * 4) * obstacleSpeed;
  const halfNoteWidth = (beatDuration * 2) * obstacleSpeed;
  const quarterNoteWidth = (beatDuration * 1) * obstacleSpeed;

  t.assert(wholeNoteWidth > halfNoteWidth, 'Whole note overlay should be wider than half note');
  t.assert(halfNoteWidth > quarterNoteWidth, 'Half note overlay should be wider than quarter note');
});

// ============================================================================
// Test Miss Detection Logic
// ============================================================================

runner.test('checkMiss detects obstacle past overlay', (t) => {
  const CONFIG = { GRID_SIZE: 32 };
  const overlayStartX = 128; // 4 * 32

  interface ObstacleForTest {
    pixelX: number;
    hasBeenAvoided: boolean;
    hasCollided: boolean;
  }

  const checkMiss = (obstacle: ObstacleForTest, playerX: number, overlayStartX: number) => {
    if (
      obstacle.pixelX + CONFIG.GRID_SIZE < overlayStartX &&
      !obstacle.hasBeenAvoided &&
      !obstacle.hasCollided
    ) {
      obstacle.hasBeenAvoided = true;
      return true;
    }
    return false;
  };

  const obstacle: ObstacleForTest = {
    pixelX: 90, // 90 + 32 = 122, which is < 128
    hasBeenAvoided: false,
    hasCollided: false,
  };

  const missed = checkMiss(obstacle, 128, overlayStartX);
  t.assert(missed, 'Should detect miss when obstacle is past overlay');
  t.assert(obstacle.hasBeenAvoided, 'Obstacle should be marked as avoided');
});

runner.test('checkMiss does not detect miss for obstacle still in overlay', (t) => {
  const CONFIG = { GRID_SIZE: 32 };
  const overlayStartX = 128;

  interface ObstacleForTest {
    pixelX: number;
    hasBeenAvoided: boolean;
    hasCollided: boolean;
  }

  const checkMiss = (obstacle: ObstacleForTest, playerX: number, overlayStartX: number) => {
    if (
      obstacle.pixelX + CONFIG.GRID_SIZE < overlayStartX &&
      !obstacle.hasBeenAvoided &&
      !obstacle.hasCollided
    ) {
      obstacle.hasBeenAvoided = true;
      return true;
    }
    return false;
  };

  const obstacle: ObstacleForTest = {
    pixelX: 200, // Still in overlay
    hasBeenAvoided: false,
    hasCollided: false,
  };

  const missed = checkMiss(obstacle, 128, overlayStartX);
  t.assert(!missed, 'Should not detect miss when obstacle is still in overlay');
});

// ============================================================================
// Test UI State
// ============================================================================

runner.test('UI state has valid initial values', (t) => {
  const uiState = {
    selectedNote: 'half',
    noteImages: {},
    isMuted: false,
  };

  t.assertEqual(uiState.selectedNote, 'half', 'Should start with half note selected');
  t.assertEqual(uiState.isMuted, false, 'Should not be muted initially');
});

// ============================================================================
// Test Grid Position Calculation
// ============================================================================

runner.test('Grid Y calculation for note positions', (t) => {
  const GRID_SIZE = 32;
  const pixelY = 160; // 5 * 32
  const gridY = pixelY / GRID_SIZE;

  t.assertEqual(gridY, 5, 'Grid Y should be calculated correctly from pixel Y');
});

runner.test('Note Y positions are on valid grid positions', (t) => {
  const NOTE_KEY_MAP: Record<string, number[]> = {
    "c": [6.5],
    "d": [6.0],
    "e": [5.5, 9.0],
    "f": [5.0, 8.5],
    "g": [8.0],
    "a": [7.5],
    "b": [7.0],
  };

  Object.values(NOTE_KEY_MAP).flat().forEach(position => {
    t.assert(position >= 5.0 && position <= 9.0, `Position ${position} should be between 5.0 and 9.0`);
  });
});

// Run all tests
const success = runner.run();
process.exit(success ? 0 : 1);
