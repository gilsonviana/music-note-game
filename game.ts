// Type definitions for the game

interface ObstacleGenerator {
  pixelX: number;
  pixelY: number;
  imagePath: string | null;
  image: HTMLImageElement | null;
  speed: number;
  hasBeenAvoided: boolean;
  hasCollided: boolean;
  fadeAnimation: FadeAnimation;
}

interface FadeAnimation {
  isAnimating: boolean;
  progress: number;
  duration: number;
  start(): void;
  update(delta: number): void;
  getAlpha(): number;
  getScale(): number;
  getRotation(): number;
  getShake(): { x: number; y: number };
}

interface UIState {
  selectedNote: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
  noteImages: Record<string, HTMLImageElement>;
  isMuted: boolean;
}

interface Movement {
  isMoving: boolean;
  moveProgress: number;
  nextPixelX: number | null;
  nextPixelY: number | null;
}

interface Config {
  GRID_SIZE: number;
  PLAYER_SIZE: number;
  MOVE_SPEED: number;
  PLAYER_INITIAL_GRID_X: number;
  PLAYER_INITIAL_GRID_Y: number;
  OBSTACLE_SPEED: number;
  OBSTACLE_SPAWN_INTERVAL: number;
  OBSTACLE_SPAWN_Y: number;
  COLLISION_POINTS_GAINED: number;
  MISS_POINTS_LOST: number;
  ENABLE_X_AXIS_MOVEMENT: boolean;
  BPM: number;
  STAFF_POSITIONS: number;
}

interface NoteKeyMap {
  [key: string]: number[];
}

interface ObstacleSpawner {
  timeSinceLastSpawn: number;
  monsterImages: string[];
  currentImageIndex: number;
  getNextImage(): string;
}

interface Lives {
  current: number;
  max: number;
  loseLife(): boolean;
  checkMiss(
    obstacle: ObstacleGenerator,
    playerX: number,
    overlayStartX: number
  ): boolean;
  isGameOver(): boolean;
  reset(): void;
}

interface Score {
  current: number;
  addPoints(points: number): void;
  reset(): void;
}

interface GameState {
  hasStarted: boolean;
  isGameOver: boolean;
  isNoteKeyPressed: boolean;
  currentNoteGridY: number | null;
  elapsedTime: number;
  difficulty: number;
}

interface UILayout {
  sidebarWidth: number;
  noteIconSize: number;
  noteSpacing: number;
  startY: number;
  muteButtonY: number;
  muteButtonWidth: number;
  muteButtonHeight: number;
}

interface Player {
  color: string;
  pixelX: number;
  pixelY: number;
  size: number;
  imagePath: string;
  image: HTMLImageElement | null;
  noteValue: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
  readonly gridX: number;
  readonly gridY: number;
  getPixelX(): number;
  getPixelY(): number;
  updateNoteValue(): void;
}

interface PlayerAnimation {
  isAnimating: boolean;
  progress: number;
  duration: number;
  start(): void;
  update(delta: number): void;
  getScale(): number;
  getShake(): { x: number; y: number };
}

interface TrebleClef {
  imagePath: string;
  image: HTMLImageElement | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Audio {
  context: AudioContext | null;
  isMuted: boolean;
  noteFrequencies: Record<string, number>;
  noteNames: Record<string, string>;
  init(): void;
  playNote(pixelY: number, noteDuration?: number | null): void;
  playErrorSound(): void;
  toggleMute(): boolean;
}

interface NoteDisplay {
  noteName: string | null;
  displayTime: number;
  displayDuration: number;
  show(pixelY: number): void;
  update(delta: number): void;
  getAlpha(): number;
}

interface HitZoneFlash {
  isFlashing: boolean;
  color: 'green' | 'red';
  progress: number;
  duration: number;
  start(color: 'green' | 'red'): void;
  update(delta: number): void;
  getAlpha(): number;
}

// Constants
const NOTE_VALUES: Array<
  'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
> = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];

const obstacleGenerator = (
  pixelX: number = 0,
  pixelY: number = 0,
  imagePath: string | null = null,
  speed: number = 100
): ObstacleGenerator => {
  return {
    pixelX,
    pixelY,
    imagePath,
    image: null,
    speed,
    hasBeenAvoided: false,
    hasCollided: false,
    fadeAnimation: {
      isAnimating: false,
      progress: 0,
      duration: 0.5,
      start(this: FadeAnimation) {
        this.isAnimating = true;
        this.progress = 0;
      },
      update(this: FadeAnimation, delta: number) {
        if (this.isAnimating) {
          this.progress += delta / this.duration;
          if (this.progress >= 1) {
            this.progress = 1;
            this.isAnimating = false;
          }
        }
      },
      getAlpha(this: FadeAnimation): number {
        if (!this.isAnimating) {
          return 1;
        }
        return Math.max(0, 1 - this.progress);
      },
      getScale(this: FadeAnimation): number {
        if (!this.isAnimating) {
          return 1;
        }
        const explosionPhase = this.progress;
        if (explosionPhase < 0.3) {
          return 1 + explosionPhase * 0.5;
        } else {
          return Math.max(0, 1.15 - this.progress * 2.3);
        }
      },
      getRotation(this: FadeAnimation): number {
        if (!this.isAnimating) {
          return 0;
        }
        return this.progress * Math.PI * 4;
      },
      getShake(this: FadeAnimation): { x: number; y: number } {
        if (!this.isAnimating) {
          return { x: 0, y: 0 };
        }
        const shakeAmount = (1 - this.progress) * 8;
        return {
          x: (Math.random() - 0.5) * shakeAmount,
          y: (Math.random() - 0.5) * shakeAmount,
        };
      },
    },
  };
};

const main = (debug: boolean = false): void => {
  // DOM and Canvas elements
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let lastTime: number = 0;

  // UI state
  const uiState: UIState = {
    selectedNote: 'half',
    noteImages: {},
    isMuted: false,
  };

  // Get selected player note value from UI
  const getSelectedPlayerNote = ():
    | 'whole'
    | 'half'
    | 'quarter'
    | 'eighth'
    | 'sixteenth' => {
    return uiState.selectedNote;
  };

  // Get player note icon path
  const getPlayerNoteIcon = (
    noteValue: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
  ): string => {
    const noteIcons: Record<
      'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth',
      string
    > = {
      whole: 'assets/MusicIcons/whole-note.png',
      half: 'assets/MusicIcons/half-note.png',
      quarter: 'assets/MusicIcons/quarter-note.png',
      eighth: 'assets/MusicIcons/eighth-note.png',
      sixteenth: 'assets/MusicIcons/sixteenth-note.png',
    };
    return noteIcons[noteValue] || noteIcons['half'];
  };

  // Get note duration in seconds based on note value
  const getNoteDuration = (
    noteValue: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
  ): number => {
    const beatDuration = 60 / CONFIG.BPM;
    const noteDurations: Record<
      'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth',
      number
    > = {
      whole: beatDuration * 4,
      half: beatDuration * 2,
      quarter: beatDuration * 1,
      eighth: beatDuration * 0.5,
      sixteenth: beatDuration * 0.25,
    };
    return noteDurations[noteValue] || noteDurations['quarter'];
  };

  // Game configuration
  const CONFIG: Config = {
    GRID_SIZE: 32,
    PLAYER_SIZE: 32,
    MOVE_SPEED: 0.15,
    PLAYER_INITIAL_GRID_X: 4,
    PLAYER_INITIAL_GRID_Y: 4,
    OBSTACLE_SPEED: 150,
    OBSTACLE_SPAWN_INTERVAL: 2,
    OBSTACLE_SPAWN_Y: 5,
    COLLISION_POINTS_GAINED: 100,
    MISS_POINTS_LOST: -50,
    ENABLE_X_AXIS_MOVEMENT: false,
    BPM: 90,
    STAFF_POSITIONS: 9,
  };

  // Movement state
  const movement: Movement = {
    isMoving: false,
    moveProgress: 0,
    nextPixelX: null,
    nextPixelY: null,
  };

  // Note key mapping
  const NOTE_KEY_MAP: NoteKeyMap = {
    c: [6.5],
    d: [6.0],
    e: [5.5, 9.0],
    f: [5.0, 8.5],
    g: [8.0],
    a: [7.5],
    b: [7.0],
  };

  // Obstacles on the grid
  const obstacles: ObstacleGenerator[] = [];

  // Obstacle spawning state
  const obstacleSpawner: ObstacleSpawner = {
    timeSinceLastSpawn: 0,
    monsterImages: [
      'assets/MonsterIcons/monster.png',
      'assets/MonsterIcons/monster (1).png',
      'assets/MonsterIcons/monster (2).png',
      'assets/MonsterIcons/monster (3).png',
    ],
    currentImageIndex: 0,
    getNextImage(this: ObstacleSpawner): string {
      const img = this.monsterImages[this.currentImageIndex];
      this.currentImageIndex =
        (this.currentImageIndex + 1) % this.monsterImages.length;
      return img;
    },
  };

  // Lives system
  const lives: Lives = {
    current: 5,
    max: 5,
    loseLife(this: Lives): boolean {
      if (this.current > 0) {
        this.current -= 1;
      }
      return this.isGameOver();
    },
    checkMiss(
      this: Lives,
      obstacle: ObstacleGenerator,
      playerX: number,
      overlayStartX: number
    ): boolean {
      if (
        obstacle.pixelX + CONFIG.GRID_SIZE < overlayStartX &&
        !obstacle.hasBeenAvoided &&
        !obstacle.hasCollided
      ) {
        obstacle.hasBeenAvoided = true;
        this.loseLife();
        return true;
      }
      return false;
    },
    isGameOver(this: Lives): boolean {
      return this.current <= 0;
    },
    reset(this: Lives): void {
      this.current = this.max;
    },
  };

  // Score system
  const score: Score = {
    current: 0,
    addPoints(this: Score, points: number): void {
      this.current += points;
    },
    reset(this: Score): void {
      this.current = 0;
    },
  };

  // Game state
  const gameState: GameState = {
    hasStarted: false,
    isGameOver: false,
    isNoteKeyPressed: false,
    currentNoteGridY: null,
    elapsedTime: 0,
    difficulty: 1,
  };

  // UI Layout constants
  const UI_LAYOUT: UILayout = {
    sidebarWidth: 120,
    noteIconSize: 32,
    noteSpacing: 65,
    startY: 80,
    muteButtonY: 420,
    muteButtonWidth: 100,
    muteButtonHeight: 40,
  };

  /**
   * Calculate difficulty level based on elapsed time
   */
  const calculateDifficulty = (elapsedTime: number): number => {
    return Math.min(5, Math.floor(elapsedTime / 30) + 1);
  };

  /**
   * Get the current spawn interval based on difficulty
   */
  const getSpawnInterval = (difficulty: number): number => {
    return Math.max(0.8, 2 - (difficulty - 1) * 0.2);
  };

  /**
   * Get the current obstacle speed based on difficulty
   */
  const getObstacleSpeed = (difficulty: number): number => {
    return 150 + (difficulty - 1) * 30;
  };

  /**
   * Check if a grid position is blocked by an obstacle
   */
  const _getObstacleAt = (
    gridX: number,
    gridY: number
  ): ObstacleGenerator | null => {
    const pixelX = gridX * CONFIG.GRID_SIZE;
    const pixelY = gridY * CONFIG.GRID_SIZE;
    const tolerance = CONFIG.GRID_SIZE / 2;

    return (
      obstacles.find(
        (obs) =>
          Math.abs(obs.pixelX - pixelX) < tolerance &&
          Math.abs(obs.pixelY - pixelY) < tolerance
      ) || null
    );
  };

  /**
   * Audio system for playing musical notes
   */
  const audio: Audio = {
    context: null,
    isMuted: false,

    noteFrequencies: {
      '5.0': 698.46,
      '5.5': 659.25,
      '6.0': 587.33,
      '6.5': 523.25,
      '7.0': 493.88,
      '7.5': 440.0,
      '8.0': 392.0,
      '8.5': 349.23,
      '9.0': 329.63,
    },

    noteNames: {
      '5.0': 'F',
      '5.5': 'E',
      '6.0': 'D',
      '6.5': 'C',
      '7.0': 'B',
      '7.5': 'A',
      '8.0': 'G',
      '8.5': 'F',
      '9.0': 'E',
    },

    init(this: Audio) {
      if (!this.context) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        this.context = new AudioContextClass();
      }
      if (this.context && this.context.state === 'suspended') {
        void this.context.resume().catch((err) => {
          console.warn('Failed to resume audio context:', err);
        });
      }
    },

    playNote(this: Audio, pixelY: number, noteDuration: number | null = null) {
      if (!this.context || this.isMuted) {
        return;
      }

      const duration =
        noteDuration !== null
          ? noteDuration
          : getNoteDuration(player.noteValue);
      const gridY = pixelY / CONFIG.GRID_SIZE;
      const roundedGridY = Math.round(gridY * 2) / 2;
      const noteKey = roundedGridY.toFixed(1);
      const frequency = this.noteFrequencies[noteKey] || 261.63;

      const now = this.context.currentTime;

      // Warmer, more gentle envelope
      const attackTime = 0.05; // Slower attack for gentler sound
      const decayTime = 0.4;
      const sustainLevel = 0.12;
      const releaseTime = 0.8; // Longer release for warmth

      const osc1 = this.context.createOscillator();
      const gain1 = this.context.createGain();

      osc1.connect(gain1);
      gain1.connect(this.context.destination);

      osc1.frequency.value = frequency;
      osc1.type = 'sine'; // Changed from triangle to sine for warmer tone

      const osc2 = this.context.createOscillator();
      const gain2 = this.context.createGain();

      osc2.connect(gain2);
      gain2.connect(this.context.destination);

      osc2.frequency.value = frequency * 2;
      osc2.type = 'sine'; // Changed from triangle to sine
      gain2.gain.setValueAtTime(0.04, now); // Reduced from 0.1 to 0.04

      const osc3 = this.context.createOscillator();
      const gain3 = this.context.createGain();

      osc3.connect(gain3);
      gain3.connect(this.context.destination);

      osc3.frequency.value = frequency * 3;
      osc3.type = 'sine';
      gain3.gain.setValueAtTime(0.015, now); // Reduced from 0.05 to 0.015

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + attackTime); // Reduced from 0.35
      gain1.gain.linearRampToValueAtTime(
        sustainLevel,
        now + attackTime + decayTime
      );

      const noteEndTime = now + duration;

      gain1.gain.linearRampToValueAtTime(0, noteEndTime + releaseTime);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);

      osc1.stop(noteEndTime + releaseTime);
      osc2.stop(noteEndTime + releaseTime);
      osc3.stop(noteEndTime + releaseTime);
    },

    playErrorSound(this: Audio) {
      if (!this.context || this.isMuted) {
        return;
      }

      try {
        if (this.context.state === 'suspended') {
          void this.context.resume();
        }

        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);

        oscillator.frequency.value = 277.18;
        oscillator.type = 'sine';

        const duration = 0.4;
        const now = this.context.currentTime;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);
      } catch (err) {
        console.error('Error playing error sound:', err);
      }
    },

    toggleMute(this: Audio): boolean {
      this.isMuted = !this.isMuted;
      return this.isMuted;
    },
  };

  /**
   * Note display system for showing note names on screen
   */
  const noteDisplay: NoteDisplay = {
    noteName: null,
    displayTime: 0,
    displayDuration: 0.8,

    show(this: NoteDisplay, pixelY: number) {
      const gridY = pixelY / CONFIG.GRID_SIZE;
      const roundedGridY = Math.round(gridY * 2) / 2;
      const noteKey = roundedGridY.toFixed(1);
      this.noteName = audio.noteNames[noteKey] || 'C';
      this.displayTime = 0;
    },

    update(this: NoteDisplay, delta: number) {
      if (this.noteName) {
        this.displayTime += delta;
        if (this.displayTime >= this.displayDuration) {
          this.noteName = null;
        }
      }
    },

    getAlpha(this: NoteDisplay): number {
      if (!this.noteName) {
        return 0;
      }
      return Math.max(0, 1 - this.displayTime / this.displayDuration);
    },
  };

  // Hit zone flash effect
  const hitZoneFlash: HitZoneFlash = {
    isFlashing: false,
    color: 'green',
    progress: 0,
    duration: 0.3,
    start(this: HitZoneFlash, color: 'green' | 'red'): void {
      this.isFlashing = true;
      this.color = color;
      this.progress = 0;
    },
    update(this: HitZoneFlash, delta: number): void {
      if (this.isFlashing) {
        this.progress += delta / this.duration;
        if (this.progress >= 1) {
          this.progress = 1;
          this.isFlashing = false;
        }
      }
    },
    getAlpha(this: HitZoneFlash): number {
      if (!this.isFlashing) {
        return 0;
      }
      return Math.max(0, 1 - this.progress);
    },
  };

  /**
   * Check if player is currently colliding with any obstacle
   */
  const checkPlayerCollisions = (): void => {
    obstacles.forEach((obs) => {
      const playerPixelX = player.getPixelX();
      const playerPixelY = player.getPixelY();

      const dx = Math.abs(
        playerPixelX +
          CONFIG.PLAYER_SIZE / 2 -
          (obs.pixelX + CONFIG.GRID_SIZE / 2)
      );

      const playerGridY = (playerPixelY / CONFIG.GRID_SIZE).toFixed(1);
      const obsGridY = (obs.pixelY / CONFIG.GRID_SIZE).toFixed(1);

      const collision = dx < CONFIG.PLAYER_SIZE && playerGridY === obsGridY;

      if (collision && !obs.hasCollided) {
        obs.hasCollided = true;
        score.addPoints(CONFIG.COLLISION_POINTS_GAINED);
        audio.playNote(obs.pixelY);
        noteDisplay.show(obs.pixelY);
        obs.fadeAnimation.start();
        playerAnimation.start();
        hitZoneFlash.start('green');
      }
    });
  };

  // Player object
  const player: Player = {
    color: '#4CAF50',
    pixelX: CONFIG.PLAYER_INITIAL_GRID_X * CONFIG.GRID_SIZE,
    pixelY: CONFIG.PLAYER_INITIAL_GRID_Y * CONFIG.GRID_SIZE,
    size: CONFIG.PLAYER_SIZE,
    imagePath: getPlayerNoteIcon(getSelectedPlayerNote()),
    image: null,
    noteValue: getSelectedPlayerNote(),
    get gridX(): number {
      return Math.round(this.pixelX / CONFIG.GRID_SIZE);
    },
    get gridY(): number {
      return Math.round(this.pixelY / CONFIG.GRID_SIZE);
    },
    getPixelX(this: Player): number {
      if (movement.isMoving && movement.nextPixelX !== null) {
        return (
          this.pixelX +
          (movement.nextPixelX - this.pixelX) * movement.moveProgress
        );
      }
      return this.pixelX;
    },
    getPixelY(this: Player): number {
      if (movement.isMoving && movement.nextPixelY !== null) {
        return (
          this.pixelY +
          (movement.nextPixelY - this.pixelY) * movement.moveProgress
        );
      }
      return this.pixelY;
    },
    updateNoteValue(this: Player): void {
      const selectedNote = getSelectedPlayerNote();
      if (selectedNote !== this.noteValue) {
        this.noteValue = selectedNote;
        this.imagePath = getPlayerNoteIcon(selectedNote);
        this.image = null;
      }
    },
  };

  // Player animation state
  const playerAnimation: PlayerAnimation = {
    isAnimating: false,
    progress: 0,
    duration: 0.2,
    start(this: PlayerAnimation) {
      this.isAnimating = true;
      this.progress = 0;
    },
    update(this: PlayerAnimation, delta: number) {
      if (this.isAnimating) {
        this.progress += delta / this.duration;
        if (this.progress >= 1) {
          this.progress = 1;
          this.isAnimating = false;
        }
      }
    },
    getScale(this: PlayerAnimation): number {
      if (!this.isAnimating) {
        return 1;
      }
      const t = this.progress;
      return 1 + 0.3 * Math.sin(t * Math.PI);
    },
    getShake(this: PlayerAnimation): { x: number; y: number } {
      if (!this.isAnimating) {
        return { x: 0, y: 0 };
      }
      const t = this.progress;
      const intensity = 5 * (1 - t);
      return {
        x: Math.sin(t * Math.PI * 8) * intensity,
        y: Math.cos(t * Math.PI * 8) * intensity,
      };
    },
  };

  // Treble clef object
  const trebleClef: TrebleClef = {
    imagePath: 'assets/MusicIcons/treble-clef.png',
    image: null,
    x: 1 * CONFIG.GRID_SIZE,
    y: 5 * CONFIG.GRID_SIZE,
    width: 3 * CONFIG.GRID_SIZE,
    height: (10 - 5) * CONFIG.GRID_SIZE,
  };

  /**
   * Update game logic based on elapsed time
   */
  const update = (delta: number): void => {
    if (gameState.hasStarted && !gameState.isGameOver) {
      gameState.elapsedTime += delta;
      const newDifficulty = calculateDifficulty(gameState.elapsedTime);
      gameState.difficulty = newDifficulty;
    }

    if (player.image === null && player.imagePath) {
      void loadPlayerImage();
    }

    obstacleSpawner.timeSinceLastSpawn += delta;
    const currentSpawnInterval = getSpawnInterval(gameState.difficulty);
    if (obstacleSpawner.timeSinceLastSpawn >= currentSpawnInterval) {
      obstacleSpawner.timeSinceLastSpawn = 0;
      const imagePath = obstacleSpawner.getNextImage();
      const randomIndex = Math.floor(Math.random() * CONFIG.STAFF_POSITIONS);
      const randomGridY = 5 + randomIndex * 0.5;
      const gameWidth = canvas.width - UI_LAYOUT.sidebarWidth;
      const currentSpeed = getObstacleSpeed(gameState.difficulty);
      const newObstacle = obstacleGenerator(
        gameWidth,
        randomGridY * CONFIG.GRID_SIZE,
        imagePath,
        currentSpeed
      );
      if (imageCache[imagePath]) {
        newObstacle.image = imageCache[imagePath];
      }
      obstacles.push(newObstacle);
    }

    obstacles.forEach((obs) => {
      obs.pixelX -= obs.speed * delta;
      obs.fadeAnimation.update(delta);
    });

    const noteDuration = getNoteDuration(player.noteValue);
    const obstacleSpeed = 150;
    const overlayWidth = noteDuration * obstacleSpeed;
    const overlayStartX = trebleClef.x + trebleClef.width;
    const _overlayEndX = overlayStartX + overlayWidth;

    obstacles.forEach((obs) => {
      if (lives.checkMiss(obs, player.pixelX, overlayStartX)) {
        audio.playErrorSound();
        if (lives.isGameOver()) {
          gameState.isGameOver = true;
        }
      }
    });

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      if (
        obs.pixelX + CONFIG.GRID_SIZE < 0 ||
        (obs.fadeAnimation.progress >= 1 && !obs.fadeAnimation.isAnimating)
      ) {
        obstacles.splice(i, 1);
      }
    }

    if (movement.isMoving) {
      movement.moveProgress += delta / CONFIG.MOVE_SPEED;

      if (movement.moveProgress >= 1) {
        movement.moveProgress = 1;
        player.pixelX = movement.nextPixelX ?? 0;
        player.pixelY = movement.nextPixelY ?? 0;
        movement.isMoving = false;
        movement.nextPixelX = null;
        movement.nextPixelY = null;
      }
    }

    checkPlayerCollisions();
    playerAnimation.update(delta);
    noteDisplay.update(delta);
    hitZoneFlash.update(delta);
  };

  /**
   * Draw UI sidebar on canvas
   */
  const drawUI = (): void => {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, UI_LAYOUT.sidebarWidth, canvas.height);

    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(UI_LAYOUT.sidebarWidth, 0);
    ctx.lineTo(UI_LAYOUT.sidebarWidth, canvas.height);
    ctx.stroke();

    ctx.fillStyle = '#333333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Player Note', UI_LAYOUT.sidebarWidth / 2, 30);

    NOTE_VALUES.forEach((note, index) => {
      const y = UI_LAYOUT.startY + index * UI_LAYOUT.noteSpacing;
      const centerX = UI_LAYOUT.sidebarWidth / 2;

      if (note === uiState.selectedNote) {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(
          10,
          y - UI_LAYOUT.noteIconSize / 2,
          UI_LAYOUT.sidebarWidth - 20,
          UI_LAYOUT.noteIconSize + 16
        );
      }

      const img = uiState.noteImages[note];
      if (img && img.complete) {
        ctx.drawImage(
          img,
          centerX - UI_LAYOUT.noteIconSize / 2,
          y - UI_LAYOUT.noteIconSize / 2,
          UI_LAYOUT.noteIconSize,
          UI_LAYOUT.noteIconSize
        );
      }

      ctx.fillStyle = note === uiState.selectedNote ? '#ffffff' : '#666666';
      ctx.font = '11px Arial';
      ctx.fillText(
        note.charAt(0).toUpperCase() + note.slice(1),
        centerX,
        y + UI_LAYOUT.noteIconSize / 2 + 12
      );
    });

    const muteX = 10;
    const muteY = UI_LAYOUT.muteButtonY;
    ctx.fillStyle = uiState.isMuted ? '#FF6B6B' : '#4CAF50';
    ctx.fillRect(
      muteX,
      muteY,
      UI_LAYOUT.muteButtonWidth,
      UI_LAYOUT.muteButtonHeight
    );
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      muteX,
      muteY,
      UI_LAYOUT.muteButtonWidth,
      UI_LAYOUT.muteButtonHeight
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      uiState.isMuted ? '🔇' : '🔊',
      muteX + UI_LAYOUT.muteButtonWidth / 2,
      muteY + UI_LAYOUT.muteButtonHeight / 2 + 7
    );
  };

  /**
   * Render the game scene
   */
  const render = (): void => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawUI();

    ctx.save();
    ctx.translate(UI_LAYOUT.sidebarWidth, 0);

    const gameWidth = canvas.width - UI_LAYOUT.sidebarWidth;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    const totalLineHeight = 4 * CONFIG.GRID_SIZE;
    const startY = (canvas.height - totalLineHeight) / 2;
    for (let i = 0; i < 5; i++) {
      const y = startY + i * CONFIG.GRID_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(gameWidth, y);
      ctx.stroke();
    }

    if (trebleClef.image && trebleClef.image.complete) {
      ctx.drawImage(
        trebleClef.image,
        trebleClef.x,
        trebleClef.y,
        trebleClef.width,
        trebleClef.height
      );
    }

    const noteDuration = getNoteDuration(player.noteValue);
    const obstacleSpeed = 150;
    const overlayWidth = noteDuration * obstacleSpeed;
    const overlayStartX = trebleClef.x + trebleClef.width;
    const staffHeight = 4 * CONFIG.GRID_SIZE;

    ctx.fillStyle = 'rgba(144, 238, 144, 0.3)';
    ctx.fillRect(overlayStartX, startY, overlayWidth, staffHeight);

    // Draw hit zone flash effect
    if (hitZoneFlash.isFlashing) {
      const flashAlpha = hitZoneFlash.getAlpha();
      ctx.fillStyle =
        hitZoneFlash.color === 'green'
          ? `rgba(76, 175, 80, ${flashAlpha * 0.6})`
          : `rgba(255, 107, 107, ${flashAlpha * 0.6})`;
      ctx.fillRect(overlayStartX, startY, overlayWidth, staffHeight);
    }

    if (debug) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      for (let x = 0; x <= canvas.width; x += CONFIG.GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (
        let y = CONFIG.GRID_SIZE / 2;
        y <= canvas.height;
        y += CONFIG.GRID_SIZE
      ) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    if (gameState.isNoteKeyPressed && gameState.currentNoteGridY !== null) {
      const scale = playerAnimation.getScale();
      const shake = playerAnimation.getShake();
      const playerX = player.getPixelX() + shake.x;
      const playerY = gameState.currentNoteGridY * CONFIG.GRID_SIZE + shake.y;

      if (player.image && player.image.complete) {
        ctx.save();
        const centerX = playerX + player.size / 2;
        const centerY = playerY + player.size / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);

        ctx.drawImage(player.image, playerX, playerY, player.size, player.size);

        ctx.restore();
      } else {
        ctx.save();
        const centerX = playerX + player.size / 2;
        const centerY = playerY + player.size / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);

        ctx.fillStyle = player.color;
        ctx.fillRect(playerX, playerY, player.size, player.size);

        ctx.restore();
      }
    }

    obstacles.forEach((obs) => {
      const alpha = obs.fadeAnimation.getAlpha();
      const scale = obs.fadeAnimation.getScale();
      const rotation = obs.fadeAnimation.getRotation();
      const shake = obs.fadeAnimation.getShake();

      if (obs.image && obs.image.complete) {
        ctx.save();
        ctx.globalAlpha = alpha;

        const centerX = obs.pixelX + CONFIG.GRID_SIZE / 2 + shake.x;
        const centerY = obs.pixelY + CONFIG.GRID_SIZE / 2 + shake.y;
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        ctx.translate(-CONFIG.GRID_SIZE / 2, -CONFIG.GRID_SIZE / 2);

        ctx.drawImage(obs.image, 0, 0, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;

        const centerX = obs.pixelX + CONFIG.GRID_SIZE / 2 + shake.x;
        const centerY = obs.pixelY + CONFIG.GRID_SIZE / 2 + shake.y;
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        ctx.translate(-CONFIG.GRID_SIZE / 2, -CONFIG.GRID_SIZE / 2);

        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(0, 0, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
        ctx.restore();
      }
    });

    if (noteDisplay.noteName) {
      const alpha = noteDisplay.getAlpha();
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 72px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(noteDisplay.noteName, gameWidth / 2, canvas.height / 2);
      ctx.restore();
    }

    ctx.fillStyle = lives.current === 0 ? '#FF0000' : '#000000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${score.current}`, gameWidth - 20, 60);

    if (gameState.hasStarted && !gameState.isGameOver) {
      ctx.fillStyle = '#4CAF50';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`Level: ${gameState.difficulty}`, gameWidth - 20, 90);
    }
    ctx.textAlign = 'left';

    if (!gameState.hasStarted) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, gameWidth, canvas.height);
      ctx.fillStyle = '#00CC00';
      ctx.font = 'bold 72px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Music Note Game', gameWidth / 2, canvas.height / 2 - 80);

      const buttonWidth = 200;
      const buttonHeight = 60;
      const buttonX = gameWidth / 2 - buttonWidth / 2;
      const buttonY = canvas.height / 2 + 20;

      ctx.fillStyle = '#00CC00';
      ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 32px Arial';
      ctx.fillText('START', gameWidth / 2, buttonY + buttonHeight / 2);
    }

    if (gameState.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, gameWidth, canvas.height);
      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 72px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', gameWidth / 2, canvas.height / 2 - 60);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 32px Arial';
      ctx.fillText(
        'Press R to try again',
        gameWidth / 2,
        canvas.height / 2 + 40
      );
    }

    if (gameState.hasStarted && !gameState.isGameOver) {
      ctx.fillStyle = '#333333';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const instructionY = canvas.height - 120;
      const instructionX = UI_LAYOUT.sidebarWidth;

      ctx.fillText('How to Play:', instructionX, instructionY);
      ctx.font = '12px Arial';
      ctx.fillText(
        '• Press C, D, E, F, G, A, B to match the notes',
        instructionX,
        instructionY + 20
      );
      ctx.fillText(
        '• Select note duration from the sidebar',
        instructionX,
        instructionY + 35
      );
      ctx.fillText("• Don't miss the notes!", instructionX, instructionY + 50);
    }

    if (debug) {
      ctx.fillStyle = '#333333';
      ctx.font = '12px Arial';
      const gridX = (player.pixelX / CONFIG.GRID_SIZE).toFixed(1);
      const gridY = (player.pixelY / CONFIG.GRID_SIZE).toFixed(1);
      ctx.fillText(`Player Pos: (${gridX}, ${gridY})`, 10, 20);
      ctx.fillText(
        `Pixel: (${Math.round(player.getPixelX())}, ${Math.round(
          player.getPixelY()
        )})`,
        10,
        32
      );
      ctx.fillText(`Moving: ${movement.isMoving}`, 10, 44);
      ctx.fillText(`Obstacles: ${obstacles.length}`, 10, 56);
    }

    ctx.restore();
  };

  /**
   * Main game loop
   */
  const loop = (timestamp: number): void => {
    const delta = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    const cappedDelta = Math.min(delta, 0.016);

    if (gameState.hasStarted && !gameState.isGameOver) {
      update(cappedDelta);
    }
    render();

    requestAnimationFrame(loop);
  };

  /**
   * Handle note key press - check for collision with obstacles
   */
  const handleNoteKeyPress = (gridYArray: number[]): void => {
    const gridYs = Array.isArray(gridYArray) ? gridYArray : [gridYArray];

    const noteDuration = getNoteDuration(player.noteValue);
    const obstacleSpeed = 150;
    const overlayWidth = noteDuration * obstacleSpeed;
    const overlayStartX = trebleClef.x + trebleClef.width;
    const overlayEndX = overlayStartX + overlayWidth;

    let hitCorrectNote = false;
    let hasObstacleInOverlay = false;

    obstacles.forEach((obs) => {
      const obsCenter = obs.pixelX + CONFIG.GRID_SIZE / 2;
      const isWithinOverlay =
        obsCenter >= overlayStartX && obsCenter <= overlayEndX;

      if (isWithinOverlay && !obs.hasCollided && !obs.hasBeenAvoided) {
        hasObstacleInOverlay = true;
      }

      const obsGridY = parseFloat((obs.pixelY / CONFIG.GRID_SIZE).toFixed(1));
      const yMatch = gridYs.some((gridY) => Math.abs(gridY - obsGridY) < 0.1);

      if (yMatch && isWithinOverlay && !obs.hasCollided) {
        obs.hasCollided = true;
        hitCorrectNote = true;

        score.addPoints(CONFIG.COLLISION_POINTS_GAINED);
        audio.playNote(obs.pixelY);
        noteDisplay.show(obs.pixelY);
        obs.fadeAnimation.start();
        playerAnimation.start();
      }
    });

    if (hasObstacleInOverlay && !hitCorrectNote) {
      lives.loseLife();
      audio.playErrorSound();
      hitZoneFlash.start('red');

      if (lives.isGameOver()) {
        gameState.isGameOver = true;
      }
    }
  };

  /**
   * Cleanup function for event listeners
   */
  let _cleanupEventListeners: (() => void) | null = null;

  /**
   * Setup event listeners for input handling
   */
  const setupInputHandlers = (): void => {
    const handleCanvasClick = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (!gameState.hasStarted) {
        const buttonWidth = 200;
        const buttonHeight = 60;
        const buttonX = canvas.width / 2 - buttonWidth / 2;
        const buttonY = canvas.height / 2 + 20;

        if (
          x >= buttonX &&
          x <= buttonX + buttonWidth &&
          y >= buttonY &&
          y <= buttonY + buttonHeight
        ) {
          gameState.hasStarted = true;
          if (audio.context && audio.context.state === 'suspended') {
            void audio.context.resume();
          }
        }
        return;
      }

      if (x < UI_LAYOUT.sidebarWidth) {
        NOTE_VALUES.forEach((note, index) => {
          const noteY = UI_LAYOUT.startY + index * UI_LAYOUT.noteSpacing;
          const clickAreaTop = noteY - UI_LAYOUT.noteIconSize / 2 - 5;
          const clickAreaBottom = noteY + UI_LAYOUT.noteIconSize / 2 + 15;

          if (y >= clickAreaTop && y <= clickAreaBottom) {
            uiState.selectedNote = note;
            player.updateNoteValue();
            console.log(`Player note changed to: ${note}`);
          }
        });

        const muteX = 10;
        const muteY = UI_LAYOUT.muteButtonY;
        if (
          x >= muteX &&
          x <= muteX + UI_LAYOUT.muteButtonWidth &&
          y >= muteY &&
          y <= muteY + UI_LAYOUT.muteButtonHeight
        ) {
          uiState.isMuted = audio.toggleMute();
          console.log(`Audio ${uiState.isMuted ? 'muted' : 'unmuted'}`);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'r' && gameState.isGameOver) {
        restartGame();
        return;
      }

      if (gameState.isGameOver) {
        return;
      }

      if (audio.context && audio.context.state === 'suspended') {
        void audio.context.resume();
      }

      const noteGridYValues = NOTE_KEY_MAP[e.key.toLowerCase()];
      if (noteGridYValues !== undefined) {
        gameState.isNoteKeyPressed = true;

        const gridYArray = Array.isArray(noteGridYValues)
          ? noteGridYValues
          : [noteGridYValues];
        let targetGridY = gridYArray[0];

        const obstaclesAtNote = obstacles.filter((obs) => {
          const obsGridY = (obs.pixelY / CONFIG.GRID_SIZE).toFixed(1);
          return gridYArray.some(
            (gridY) => Math.abs(gridY - parseFloat(obsGridY)) < 0.1
          );
        });

        if (obstaclesAtNote.length > 0) {
          const closestObstacle = obstaclesAtNote.reduce((closest, current) => {
            return current.pixelX > closest.pixelX ? current : closest;
          });
          targetGridY = closestObstacle.pixelY / CONFIG.GRID_SIZE;
        }

        gameState.currentNoteGridY = targetGridY;
        handleNoteKeyPress(noteGridYValues);
        e.preventDefault();
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (gameState.isGameOver) {
        return;
      }

      const noteGridYValues = NOTE_KEY_MAP[e.key.toLowerCase()];
      if (noteGridYValues !== undefined) {
        gameState.isNoteKeyPressed = false;
        gameState.currentNoteGridY = null;
        e.preventDefault();
      }
    };

    canvas.addEventListener('click', handleCanvasClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Store cleanup function
    _cleanupEventListeners = () => {
      canvas.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      console.log('Event listeners cleaned up');
    };
  };

  /**
   * Generic image loader helper
   */
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`Failed to load image: ${src}`);
        reject(new Error(`Failed to load image: ${src}`));
      };
    });
  };

  /**
   * Restart the game
   */
  const restartGame = (): void => {
    lives.reset();
    score.reset();
    gameState.isGameOver = false;
    gameState.hasStarted = true;
    gameState.elapsedTime = 0;
    gameState.difficulty = 1;
    obstacles.length = 0;

    player.pixelX = CONFIG.PLAYER_INITIAL_GRID_X * CONFIG.GRID_SIZE;
    player.pixelY = CONFIG.PLAYER_INITIAL_GRID_Y * CONFIG.GRID_SIZE;

    movement.isMoving = false;
    movement.moveProgress = 0;
    movement.nextPixelX = null;
    movement.nextPixelY = null;

    playerAnimation.isAnimating = false;
    playerAnimation.progress = 0;
    noteDisplay.noteName = null;
    noteDisplay.displayTime = 0;

    obstacleSpawner.timeSinceLastSpawn = 0;

    console.log('Game state reset');
  };

  /**
   * Load all monster images for obstacles
   */
  const loadMonsterImages = async (): Promise<void[]> => {
    const monsterImages = new Set<string>();
    obstacles.forEach((obs) => {
      if (obs.imagePath) {
        monsterImages.add(obs.imagePath);
      }
    });

    obstacleSpawner.monsterImages.forEach((path) => {
      monsterImages.add(path);
    });

    const imagePromises = Array.from(monsterImages).map(async (imagePath) => {
      try {
        const img = await loadImage(imagePath);
        obstacles.forEach((obs) => {
          if (obs.imagePath === imagePath) {
            obs.image = img;
          }
        });
      } catch {
        // Error already logged in loadImage
      }
    });

    return Promise.all(imagePromises);
  };

  /**
   * Load player image
   */
  const loadPlayerImage = async (): Promise<void> => {
    if (!player.imagePath) {
      return;
    }

    try {
      player.image = await loadImage(player.imagePath);
    } catch {
      // Error already logged in loadImage
    }
  };

  /**
   * Load UI note images
   */
  const loadUIImages = async (): Promise<void[]> => {
    const promises = NOTE_VALUES.map(async (note) => {
      try {
        uiState.noteImages[note] = await loadImage(getPlayerNoteIcon(note));
      } catch {
        // Error already logged in loadImage
      }
    });
    return Promise.all(promises);
  };

  /**
   * Load treble clef image
   */
  const loadTrebleClefImage = async (): Promise<void> => {
    if (!trebleClef.imagePath) {
      return;
    }

    try {
      trebleClef.image = await loadImage(trebleClef.imagePath);
    } catch {
      // Error already logged in loadImage
    }
  };

  /**
   * Cache for loaded monster images
   */
  const imageCache: Record<string, HTMLImageElement> = {};

  /**
   * Initialize the game
   */
  const init = async (): Promise<boolean> => {
    console.log('Game init started...');

    const canvasElement = document.getElementById('game');

    if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) {
      console.error(
        "Canvas element not found! Make sure your HTML has an element with id='game'"
      );
      return false;
    }

    canvas = canvasElement;

    const context = canvas.getContext('2d');
    if (!context) {
      console.error('Failed to get 2D context from canvas');
      return false;
    }

    ctx = context;

    await loadMonsterImages();
    await loadPlayerImage();
    await loadTrebleClefImage();
    await loadUIImages();

    await Promise.all(
      obstacleSpawner.monsterImages.map(async (imagePath) => {
        try {
          imageCache[imagePath] = await loadImage(imagePath);
        } catch {
          // Error already logged in loadImage
        }
      })
    );

    setupInputHandlers();
    audio.init();

    console.log('Game initialized successfully');
    return true;
  };

  void init().then((isReady) => {
    if (isReady) {
      requestAnimationFrame(loop);
    } else {
      console.error('Game failed to initialize');
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => main());
} else {
  main();
}
