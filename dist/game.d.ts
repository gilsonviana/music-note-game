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
    getShake(): {
        x: number;
        y: number;
    };
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
    checkMiss(obstacle: ObstacleGenerator, playerX: number, overlayStartX: number): boolean;
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
    getShake(): {
        x: number;
        y: number;
    };
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
declare const NOTE_VALUES: Array<'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'>;
declare const obstacleGenerator: (pixelX?: number, pixelY?: number, imagePath?: string | null, speed?: number) => ObstacleGenerator;
declare const main: (debug?: boolean) => void;
