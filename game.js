const obstacleGenerator = (
  pixelX = 0,
  pixelY = 0,
  imagePath = null,
  speed = 100
) => {
  return {
    pixelX,
    pixelY,
    imagePath,
    image: null,
    speed,
    hasBeenAvoided: false, // Track if player has avoided this obstacle
    hasCollided: false, // Track if player has collided with this obstacle
    fadeAnimation: {
      isAnimating: false,
      progress: 0, // 0 to 1
      duration: 0.4, // Fade duration in seconds
      start() {
        this.isAnimating = true;
        this.progress = 0;
      },
      update(delta) {
        if (this.isAnimating) {
          this.progress += delta / this.duration;
          if (this.progress >= 1) {
            this.progress = 1;
            this.isAnimating = false;
          }
        }
      },
      getAlpha() {
        if (!this.isAnimating) return 1;
        // Fade out as progress goes from 0 to 1
        return Math.max(0, 1 - this.progress);
      },
      getScale() {
        if (!this.isAnimating) return 1;
        // Scale down from 1 to 0 as progress goes from 0 to 1
        return Math.max(0, 1 - this.progress);
      },
    },
  };
};

const main = (debug = false) => {
  // DOM and Canvas elements
  let canvas, ctx;
  let lastTime = 0;

  // Get selected player note value from UI
  const getSelectedPlayerNote = () => {
    return uiState.selectedNote;
  };

  // Get player note icon path
  const getPlayerNoteIcon = (noteValue) => {
    const noteIcons = {
      'whole': 'assets/MusicIcons/whole-note.png',
      'half': 'assets/MusicIcons/half-note.png',
      'quarter': 'assets/MusicIcons/quarter-note.png',
      'eighth': 'assets/MusicIcons/eighth-note.png',
      'sixteenth': 'assets/MusicIcons/sixteenth-note.png',
    };
    return noteIcons[noteValue] || noteIcons['half'];
  };

  // Get note duration in seconds based on note value
  // 4/4 time at X BPM: 1 beat = 60 / BPM seconds
  const getNoteDuration = (noteValue) => {
    const beatDuration = 60 / CONFIG.BPM;
    const noteDurations = {
      'whole': beatDuration * 4,      // 4 beats
      'half': beatDuration * 2,       // 2 beats
      'quarter': beatDuration * 1,    // 1 beat
      'eighth': beatDuration * 0.5,   // 0.5 beats
      'sixteenth': beatDuration * 0.25, // 0.25 beats
    };
    return noteDurations[noteValue] || noteDurations['quarter'];
  };

  // Game configuration
  const CONFIG = {
    GRID_SIZE: 32, // Size of each grid cell in pixels
    PLAYER_SIZE: 32,
    MOVE_SPEED: 0.15, // Seconds to move one grid cell
    PLAYER_INITIAL_GRID_X: 4,
    PLAYER_INITIAL_GRID_Y: 4,
    OBSTACLE_SPEED: 150, // pixels per second (moving left)
    OBSTACLE_SPAWN_INTERVAL: 2, // seconds between spawning obstacles
    OBSTACLE_SPAWN_Y: 5, // Grid Y position where obstacles spawn
    COLLISION_POINTS_GAINED: 100, // Points gained on collision
    MISS_POINTS_LOST: -50, // Points lost for missing an obstacle
    ENABLE_X_AXIS_MOVEMENT: false, // Enable/disable left-right movement
    BPM: 90, // Beats per minute (4/4 time signature)
  };

  // Movement state
  const movement = {
    isMoving: false,
    moveProgress: 0, // 0 to 1, how far through current move we are
    nextPixelX: null,
    nextPixelY: null,
  };

  // Note key mapping (keyboard letters to grid Y position)
  // Letters map to musical notes - some notes repeat at different octaves
  const NOTE_KEY_MAP = {
    "c": [6.5],        // C5
    "d": [6.0],        // D5
    "e": [5.5, 9.0],   // E5 and E4
    "f": [5.0, 8.5],   // F5 and F4
    "g": [8.0],        // G4
    "a": [7.5],        // A4
    "b": [7.0],        // B4
  };

  // Obstacles on the grid with monster images
  const obstacles = [];

  // Obstacle spawning state
  const obstacleSpawner = {
    timeSinceLastSpawn: 0,
    monsterImages: [
      "assets/MonsterIcons/monster.png",
      "assets/MonsterIcons/monster (1).png",
      "assets/MonsterIcons/monster (2).png",
      "assets/MonsterIcons/monster (3).png",
    ],
    currentImageIndex: 0,
    getNextImage() {
      const img = this.monsterImages[this.currentImageIndex];
      this.currentImageIndex =
        (this.currentImageIndex + 1) % this.monsterImages.length;
      return img;
    },
  };

  // Lives system
  const lives = {
    current: 5,
    max: 5,
    /**
     * Lose a life
     */
    loseLife() {
      if (this.current > 0) {
        this.current -= 1;
      }
      return this.isGameOver();
    },
    /**
     * Check if player has missed an obstacle
     */
    checkMiss(obstacle, playerX, overlayStartX) {
      // If obstacle has completely moved past the overlay (on the left side) and hasn't been hit
      // The whole obstacle is considered past when its right edge goes beyond overlayStartX
      if (
        obstacle.pixelX + CONFIG.GRID_SIZE < overlayStartX &&
        !obstacle.hasBeenAvoided &&
        !obstacle.hasCollided
      ) {
        obstacle.hasBeenAvoided = true;
        this.loseLife();
        return true; // Return true to indicate a miss occurred
      }
      return false;
    },
    /**
     * Check if game is over
     */
    isGameOver() {
      return this.current <= 0;
    },
    /**
     * Reset lives to initial state
     */
    reset() {
      this.current = this.max;
    },
  };

  // Score system
  const score = {
    current: 0,
    /**
     * Add points to the score
     */
    addPoints(points) {
      this.current += points;
    },
    /**
     * Reset score to initial state
     */
    reset() {
      this.current = 0;
    },
  };

  // Game state
  const gameState = {
    hasStarted: false,
    isGameOver: false,
    isNoteKeyPressed: false, // Track if any note key is currently pressed
    currentNoteGridY: null, // Track the Y position of the currently pressed note
  };

  // UI state
  const uiState = {
    selectedNote: 'half',
    noteImages: {},
    isMuted: false,
  };

  // UI Layout constants
  const UI_LAYOUT = {
    sidebarWidth: 120,
    noteIconSize: 32,
    noteSpacing: 65,
    startY: 80,
    muteButtonY: 420,
    muteButtonWidth: 100,
    muteButtonHeight: 40,
  };

  /**
   * Check if a grid position is blocked by an obstacle
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridY - Grid Y coordinate
   * @returns {object|null} - The obstacle at that position, or null if no obstacle
   */
  const getObstacleAt = (gridX, gridY) => {
    const pixelX = gridX * CONFIG.GRID_SIZE;
    const pixelY = gridY * CONFIG.GRID_SIZE;
    const tolerance = CONFIG.GRID_SIZE / 2; // Allow some tolerance for moving obstacles

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
  const audio = {
    context: null,
    isMuted: false,

    // Musical notes mapped to grid Y positions (5-9 including half steps)
    // C major scale descending: higher on screen = higher pitch
    noteFrequencies: {
      "5.0": 698.46,  // F5
      "5.5": 659.25,    // E5
      "6.0": 587.33,  // D5
      "6.5": 523.25,    // C5
      "7.0": 493.88,  // B4
      "7.5": 440.00,    // A4
      "8.0": 392.00,  // G4
      "8.5": 349.23,    // F4
      "9.0": 329.63,    // E4
    },

    // Note names for display
    noteNames: {
      "5.0": 'F',
      "5.5": 'E',
      "6.0": 'D',
      "6.5": 'C',
      "7.0": 'B',
      "7.5": 'A',
      "8.0": 'G',
      "8.5": 'F',
      "9.0": 'E',
    },

    init() {
      // Create audio context on first user interaction
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
      }
      // Resume context if suspended (required by modern browsers)
      if (this.context && this.context.state === 'suspended') {
        this.context.resume().catch(err => {
          console.warn('Failed to resume audio context:', err);
        });
      }
    },

    playNote(pixelY, noteDuration = null) {
      if (!this.context || this.isMuted) return;

      // Use provided duration or default to player's current note duration
      const duration = noteDuration !== null ? noteDuration : getNoteDuration(player.noteValue);

      // Convert pixel Y to grid Y (including half positions)
      const gridY = pixelY / CONFIG.GRID_SIZE;
      const roundedGridY = Math.round(gridY * 2) / 2; // Round to nearest 0.5
      // Convert to string key to properly lookup in noteFrequencies object
      const noteKey = roundedGridY.toFixed(1);
      const frequency = this.noteFrequencies[noteKey] || 261.63; // Default to C4

      // Create oscillator
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = "sine"; // Use sine wave for a pure tone

      // Envelope for smoother sound
      const now = this.context.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    },

    playErrorSound() {
      if (!this.context || this.isMuted) return;

      try {
        // Resume context if suspended
        if (this.context.state === 'suspended') {
          this.context.resume();
        }

        // Create a C# error sound beep
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);

        // C# note frequency (277.18 Hz) - more audible
        oscillator.frequency.value = 277.18;
        oscillator.type = "sine";

        // Duration for error sound
        const duration = 0.4;
        const now = this.context.currentTime;

        // Quick attack and decay envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05); // Quick attack
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Decay

        oscillator.start(now);
        oscillator.stop(now + duration);
      } catch (err) {
        console.error('Error playing error sound:', err);
      }
    },

    toggleMute() {
      this.isMuted = !this.isMuted;
      return this.isMuted;
    },
  };

  /**
   * Note display system for showing note names on screen
   */
  const noteDisplay = {
    noteName: null,
    displayTime: 0,
    displayDuration: 0.8, // Show note for 0.8 seconds

    show(pixelY) {
      const gridY = pixelY / CONFIG.GRID_SIZE;
      const roundedGridY = Math.round(gridY * 2) / 2;
      // Convert to string key to properly lookup in audio.noteNames object
      const noteKey = roundedGridY.toFixed(1);
      this.noteName = audio.noteNames[noteKey] || 'C';
      this.displayTime = 0;
    },

    update(delta) {
      if (this.noteName) {
        this.displayTime += delta;
        if (this.displayTime >= this.displayDuration) {
          this.noteName = null;
        }
      }
    },

    getAlpha() {
      if (!this.noteName) return 0;
      // Fade out over time
      return Math.max(0, 1 - this.displayTime / this.displayDuration);
    },
  };

  /**
   * Check if player is currently colliding with any obstacle
   */
  const checkPlayerCollisions = () => {
    obstacles.forEach((obs) => {
      // Get player position (accounting for interpolated movement)
      const playerPixelX = player.getPixelX();
      const playerPixelY = player.getPixelY();

      // Check X-axis overlap (obstacle must be at same X position as player)
      const dx = Math.abs(
        playerPixelX +
          CONFIG.PLAYER_SIZE / 2 -
          (obs.pixelX + CONFIG.GRID_SIZE / 2)
      );

      // Check Y-axis overlap with half-grid precision
      // Convert to grid Y positions and compare with one decimal place
      const playerGridY = (playerPixelY / CONFIG.GRID_SIZE).toFixed(1);
      const obsGridY = (obs.pixelY / CONFIG.GRID_SIZE).toFixed(1);

      // Collision occurs when X overlaps AND Y positions match exactly (including half-grid)
      const collision = dx < CONFIG.PLAYER_SIZE && playerGridY === obsGridY;

      if (collision && !obs.hasCollided) {
        obs.hasCollided = true;

        // Add points for successful collision
        score.addPoints(CONFIG.COLLISION_POINTS_GAINED);

        // Play the musical note corresponding to the obstacle's Y position
        audio.playNote(obs.pixelY);

        // Display the note name on screen
        noteDisplay.show(obs.pixelY);

        // Start monster fade animation
        obs.fadeAnimation.start();

        // Trigger player collision animation
        playerAnimation.start();
      }
    });
  };

  // Player object
  const player = {
    color: "#4CAF50",
    pixelX: CONFIG.PLAYER_INITIAL_GRID_X * CONFIG.GRID_SIZE,
    pixelY: CONFIG.PLAYER_INITIAL_GRID_Y * CONFIG.GRID_SIZE,
    size: CONFIG.PLAYER_SIZE,
    imagePath: getPlayerNoteIcon(getSelectedPlayerNote()),
    image: null,
    noteValue: getSelectedPlayerNote(),
    // Get grid X (for compatibility)
    get gridX() {
      return Math.round(this.pixelX / CONFIG.GRID_SIZE);
    },
    // Get grid Y (for compatibility)
    get gridY() {
      return Math.round(this.pixelY / CONFIG.GRID_SIZE);
    },
    // Get pixel position based on movement progress
    getPixelX() {
      if (movement.isMoving && movement.nextPixelX !== null) {
        return (
          this.pixelX +
          (movement.nextPixelX - this.pixelX) * movement.moveProgress
        );
      }
      return this.pixelX;
    },
    getPixelY() {
      if (movement.isMoving && movement.nextPixelY !== null) {
        return (
          this.pixelY +
          (movement.nextPixelY - this.pixelY) * movement.moveProgress
        );
      }
      return this.pixelY;
    },
    // Update player note based on UI selection
    updateNoteValue() {
      const selectedNote = getSelectedPlayerNote();
      if (selectedNote !== this.noteValue) {
        this.noteValue = selectedNote;
        this.imagePath = getPlayerNoteIcon(selectedNote);
        // Mark image as needing reload
        this.image = null;
      }
    },
  };

  // Player animation state
  const playerAnimation = {
    isAnimating: false,
    progress: 0, // 0 to 1
    duration: 0.2, // Animation duration in seconds
    start() {
      this.isAnimating = true;
      this.progress = 0;
    },
    update(delta) {
      if (this.isAnimating) {
        this.progress += delta / this.duration;
        if (this.progress >= 1) {
          this.progress = 1;
          this.isAnimating = false;
        }
      }
    },
    getScale() {
      if (!this.isAnimating) return 1;
      // Scale up to 1.3 and back down
      const t = this.progress;
      return 1 + 0.3 * Math.sin(t * Math.PI);
    },
    getShake() {
      if (!this.isAnimating) return { x: 0, y: 0 };
      // Shake horizontally and vertically
      const t = this.progress;
      const intensity = 5 * (1 - t); // Fade out shake
      return {
        x: Math.sin(t * Math.PI * 8) * intensity,
        y: Math.cos(t * Math.PI * 8) * intensity,
      };
    },
  };

  // Treble clef object
  const trebleClef = {
    imagePath: "assets/MusicIcons/treble-clef.png",
    image: null,
    x: 1 * CONFIG.GRID_SIZE, // Grid X position: 1
    y: 5 * CONFIG.GRID_SIZE, // Grid Y position: 5
    width: 3 * CONFIG.GRID_SIZE, // Width: 3 grid cells
    height: (10 - 5) * CONFIG.GRID_SIZE, // Height from grid 5 to 10
  };

  /**
   * Update game logic based on elapsed time
   * @param {number} delta - Time elapsed since last frame in seconds
   */
  const update = (delta) => {
    // Check if player image needs to be reloaded (when note value changes)
    if (player.image === null && player.imagePath) {
      loadPlayerImage();
    }

    // Spawn new obstacles
    obstacleSpawner.timeSinceLastSpawn += delta;
    if (obstacleSpawner.timeSinceLastSpawn >= CONFIG.OBSTACLE_SPAWN_INTERVAL) {
      obstacleSpawner.timeSinceLastSpawn = 0;
      const imagePath = obstacleSpawner.getNextImage();
      // Random Y position between grid 5 and 9 (inclusive, with half-grid steps)
      const randomIndex = Math.floor(Math.random() * 9); // 0-8 for 9 positions
      const randomGridY = 5 + randomIndex * 0.5; // 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9
      const gameWidth = canvas.width - UI_LAYOUT.sidebarWidth;
      const newObstacle = obstacleGenerator(
        gameWidth,
        randomGridY * CONFIG.GRID_SIZE,
        imagePath,
        CONFIG.OBSTACLE_SPEED
      );
      // Set the cached image immediately
      if (imageCache[imagePath]) {
        newObstacle.image = imageCache[imagePath];
      }
      obstacles.push(newObstacle);
    }

    // Update obstacle positions
    obstacles.forEach((obs) => {
      obs.pixelX -= obs.speed * delta; // Move left
      // Update fade animation
      obs.fadeAnimation.update(delta);
    });

    // Calculate overlay boundaries for miss detection
    const noteDuration = getNoteDuration(player.noteValue);
    const obstacleSpeed = 150; // pixels per second
    const overlayWidth = noteDuration * obstacleSpeed;
    const overlayStartX = trebleClef.x + trebleClef.width;
    const overlayEndX = overlayStartX + overlayWidth;

    // Check for misses
    obstacles.forEach((obs) => {
      if (lives.checkMiss(obs, player.pixelX, overlayStartX)) {
        // Play error sound on miss
        audio.playErrorSound();
        // Check if game is over after losing a life
        if (lives.isGameOver()) {
          gameState.isGameOver = true;
        }
      }
    });

    // Remove obstacles that went off-screen or finished fading
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      // Remove if off-screen or if it has finished fading away
      if (obs.pixelX + CONFIG.GRID_SIZE < 0 ||
          (obs.fadeAnimation.progress >= 1 && !obs.fadeAnimation.isAnimating)) {
        obstacles.splice(i, 1);
      }
    }

    // Update movement animation
    if (movement.isMoving) {
      movement.moveProgress += delta / CONFIG.MOVE_SPEED;

      if (movement.moveProgress >= 1) {
        // Movement complete
        movement.moveProgress = 1;
        player.pixelX = movement.nextPixelX;
        player.pixelY = movement.nextPixelY;
        movement.isMoving = false;
        movement.nextPixelX = null;
        movement.nextPixelY = null;
      }
    }

    // Check for collisions every frame
    checkPlayerCollisions();

    // Update player animation
    playerAnimation.update(delta);

    // Update note display
    noteDisplay.update(delta);
  };

  /**
   * Draw UI sidebar on canvas
   */
  const drawUI = () => {
    // Draw sidebar background
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, UI_LAYOUT.sidebarWidth, canvas.height);

    // Draw sidebar border
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(UI_LAYOUT.sidebarWidth, 0);
    ctx.lineTo(UI_LAYOUT.sidebarWidth, canvas.height);
    ctx.stroke();

    // Draw title
    ctx.fillStyle = "#333333";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Player Note", UI_LAYOUT.sidebarWidth / 2, 30);

    // Draw note options
    const notes = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
    notes.forEach((note, index) => {
      const y = UI_LAYOUT.startY + index * UI_LAYOUT.noteSpacing;
      const centerX = UI_LAYOUT.sidebarWidth / 2;

      // Highlight selected note
      if (note === uiState.selectedNote) {
        ctx.fillStyle = "#4CAF50";
        ctx.fillRect(10, y - UI_LAYOUT.noteIconSize / 2, UI_LAYOUT.sidebarWidth - 20, UI_LAYOUT.noteIconSize + 16);
      }

      // Draw note image
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

      // Draw note label
      ctx.fillStyle = note === uiState.selectedNote ? "#ffffff" : "#666666";
      ctx.font = "11px Arial";
      ctx.fillText(note.charAt(0).toUpperCase() + note.slice(1), centerX, y + UI_LAYOUT.noteIconSize / 2 + 12);
    });

    // Draw mute button
    const muteX = 10;
    const muteY = UI_LAYOUT.muteButtonY;
    ctx.fillStyle = uiState.isMuted ? "#FF6B6B" : "#4CAF50";
    ctx.fillRect(muteX, muteY, UI_LAYOUT.muteButtonWidth, UI_LAYOUT.muteButtonHeight);
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.strokeRect(muteX, muteY, UI_LAYOUT.muteButtonWidth, UI_LAYOUT.muteButtonHeight);

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      uiState.isMuted ? "🔇" : "🔊",
      muteX + UI_LAYOUT.muteButtonWidth / 2,
      muteY + UI_LAYOUT.muteButtonHeight / 2 + 7
    );
  };

  /**
   * Render the game scene
   */
  const render = () => {
    // Clear canvas with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw UI sidebar
    drawUI();

    // Save context and translate for game area
    ctx.save();
    ctx.translate(UI_LAYOUT.sidebarWidth, 0);

    // Draw 5 horizontal background lines spaced by grid size, centered vertically
    const gameWidth = canvas.width - UI_LAYOUT.sidebarWidth;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    const totalLineHeight = 4 * CONFIG.GRID_SIZE; // 4 gaps between 5 lines
    const startY = (canvas.height - totalLineHeight) / 2;
    for (let i = 0; i < 5; i++) {
      const y = startY + i * CONFIG.GRID_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(gameWidth, y);
      ctx.stroke();
    }

    // Draw treble clef at the beginning of the stave
    if (trebleClef.image && trebleClef.image.complete) {
      ctx.drawImage(
        trebleClef.image,
        trebleClef.x,
        trebleClef.y,
        trebleClef.width,
        trebleClef.height
      );
    }

    // Draw translucent greenish overlay based on note value
    // The overlay width represents the duration of the selected note
    const noteDuration = getNoteDuration(player.noteValue);
    const obstacleSpeed = 150; // pixels per second
    const overlayWidth = noteDuration * obstacleSpeed;
    const overlayStartX = trebleClef.x + trebleClef.width;
    const staffHeight = 4 * CONFIG.GRID_SIZE; // Height from first to last line

    ctx.fillStyle = "rgba(144, 238, 144, 0.3)"; // Light green with 30% opacity
    ctx.fillRect(overlayStartX, startY, overlayWidth, staffHeight);

    // Draw grid (optional, helpful for debugging)
    if (debug) {
      ctx.strokeStyle = "#e0e0e0";
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

    // Draw player only if a note key is currently pressed
    if (gameState.isNoteKeyPressed && gameState.currentNoteGridY !== null) {
      const scale = playerAnimation.getScale();
      const shake = playerAnimation.getShake();
      const playerX = player.getPixelX() + shake.x;
      // Position player at the Y position of the currently pressed note
      const playerY = gameState.currentNoteGridY * CONFIG.GRID_SIZE + shake.y;

      if (player.image && player.image.complete) {
        // Apply scaling transformation
        ctx.save();
        const centerX = playerX + player.size / 2;
        const centerY = playerY + player.size / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);

        // Draw the player image
        ctx.drawImage(player.image, playerX, playerY, player.size, player.size);

        ctx.restore();
      } else {
        // Fallback to colored square if image not loaded
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

    // Draw obstacles
    obstacles.forEach((obs) => {
      const alpha = obs.fadeAnimation.getAlpha();
      const scale = obs.fadeAnimation.getScale();

      if (obs.image && obs.image.complete) {
        // Draw the monster image with fade and scale effects
        ctx.save();
        ctx.globalAlpha = alpha;

        // Apply scaling transformation
        const centerX = obs.pixelX + CONFIG.GRID_SIZE / 2;
        const centerY = obs.pixelY + CONFIG.GRID_SIZE / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);

        ctx.drawImage(
          obs.image,
          obs.pixelX,
          obs.pixelY,
          CONFIG.GRID_SIZE,
          CONFIG.GRID_SIZE
        );
        ctx.restore();
      } else {
        // Fallback to colored square if image not loaded
        ctx.save();
        ctx.globalAlpha = alpha;

        // Apply scaling transformation
        const centerX = obs.pixelX + CONFIG.GRID_SIZE / 2;
        const centerY = obs.pixelY + CONFIG.GRID_SIZE / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);

        ctx.fillStyle = "#FF6B6B";
        ctx.fillRect(
          obs.pixelX,
          obs.pixelY,
          CONFIG.GRID_SIZE,
          CONFIG.GRID_SIZE
        );
        ctx.restore();
      }
    });

    // Draw note display (fading out)
    if (noteDisplay.noteName) {
      const alpha = noteDisplay.getAlpha();
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#333333";
      ctx.font = "bold 72px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(noteDisplay.noteName, gameWidth / 2, canvas.height / 2);
      ctx.restore();
    }

    // Draw lives and score
    ctx.fillStyle = lives.current === 0 ? "#FF0000" : "#000000";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`Lives: ${lives.current}/${lives.max}`, gameWidth - 20, 30);
    ctx.fillText(`Score: ${score.current}`, gameWidth - 20, 60);
    ctx.textAlign = "left";

    // Draw start screen
    if (!gameState.hasStarted) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(0, 0, gameWidth, canvas.height);
      ctx.fillStyle = "#00CC00";
      ctx.font = "bold 72px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Music Note Game", gameWidth / 2, canvas.height / 2 - 80);

      // Draw start button
      const buttonWidth = 200;
      const buttonHeight = 60;
      const buttonX = gameWidth / 2 - buttonWidth / 2;
      const buttonY = canvas.height / 2 + 20;

      ctx.fillStyle = "#00CC00";
      ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 32px Arial";
      ctx.fillText("START", gameWidth / 2, buttonY + buttonHeight / 2);
    }

    // Draw game over message
    if (gameState.isGameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, gameWidth, canvas.height);
      ctx.fillStyle = "#FF0000";
      ctx.font = "bold 72px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", gameWidth / 2, canvas.height / 2 - 60);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 32px Arial";
      ctx.fillText("Press R to try again", gameWidth / 2, canvas.height / 2 + 40);
    }

    // Draw position info for debugging
    if (debug) {
      ctx.fillStyle = "#333333";
      ctx.font = "12px Arial";
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

    // Restore context
    ctx.restore();
  };

  /**
   * Main game loop
   * @param {number} timestamp - Current timestamp from requestAnimationFrame
   */
  const loop = (timestamp) => {
    const delta = (timestamp - lastTime) / 1000; // Convert to seconds
    lastTime = timestamp;

    // Cap delta time to prevent large jumps (e.g., if tab was inactive)
    const cappedDelta = Math.min(delta, 0.016); // ~60fps

    if (gameState.hasStarted && !gameState.isGameOver) {
      update(cappedDelta);
    }
    render();

    requestAnimationFrame(loop);
  };

  /**
   * Handle note key press - check for collision with obstacles at that note's Y position
   */
  const handleNoteKeyPress = (gridYArray) => {
    // Ensure gridYArray is always an array
    const gridYs = Array.isArray(gridYArray) ? gridYArray : [gridYArray];

    // Calculate overlay boundaries based on note duration
    const noteDuration = getNoteDuration(player.noteValue);
    const obstacleSpeed = 150; // pixels per second
    const overlayWidth = noteDuration * obstacleSpeed;
    const overlayStartX = trebleClef.x + trebleClef.width;
    const overlayEndX = overlayStartX + overlayWidth;

    let hitCorrectNote = false;
    let hasObstacleInOverlay = false;

    // Find obstacles within the overlay section
    obstacles.forEach((obs) => {
      // Check if obstacle is within the overlay section (hitting zone)
      const obsCenter = obs.pixelX + CONFIG.GRID_SIZE / 2;
      const isWithinOverlay = obsCenter >= overlayStartX && obsCenter <= overlayEndX;

      // Track if there's any obstacle in the overlay (for wrong key detection)
      if (isWithinOverlay && !obs.hasCollided && !obs.hasBeenAvoided) {
        hasObstacleInOverlay = true;
      }

      // Check if obstacle matches any of the pressed note's Y positions
      const obsGridY = parseFloat((obs.pixelY / CONFIG.GRID_SIZE).toFixed(1));
      const yMatch = gridYs.some(gridY => Math.abs(gridY - obsGridY) < 0.1);

      // Collision occurs when Y positions match, obstacle is within overlay, and not already collided
      if (yMatch && isWithinOverlay && !obs.hasCollided) {
        obs.hasCollided = true;
        hitCorrectNote = true;

        // Add points for successful collision
        score.addPoints(CONFIG.COLLISION_POINTS_GAINED);

        // Play the musical note corresponding to the obstacle's Y position
        audio.playNote(obs.pixelY);

        // Display the note name on screen
        noteDisplay.show(obs.pixelY);

        // Start monster fade animation
        obs.fadeAnimation.start();

        // Trigger player collision animation
        playerAnimation.start();
      }
    });

    // If there's an obstacle in the overlay but we didn't hit it, it's a wrong key press
    if (hasObstacleInOverlay && !hitCorrectNote) {
      lives.loseLife();
      audio.playErrorSound();

      // Check if game is over after losing a life
      if (lives.isGameOver()) {
        gameState.isGameOver = true;
      }
    }
  };

  /**
   * Setup event listeners for input handling
   */
  const setupInputHandlers = () => {
    // Handle canvas click for start button and UI interactions
    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Handle start button click
      if (!gameState.hasStarted) {
        const buttonWidth = 200;
        const buttonHeight = 60;
        const buttonX = canvas.width / 2 - buttonWidth / 2;
        const buttonY = canvas.height / 2 + 20;

        if (x >= buttonX && x <= buttonX + buttonWidth &&
            y >= buttonY && y <= buttonY + buttonHeight) {
          gameState.hasStarted = true;
          // Initialize audio context on first interaction
          if (audio.context && audio.context.state === 'suspended') {
            audio.context.resume();
          }
        }
        return;
      }

      // Handle UI sidebar clicks
      if (x < UI_LAYOUT.sidebarWidth) {
        // Check note selection clicks
        const notes = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
        notes.forEach((note, index) => {
          const noteY = UI_LAYOUT.startY + index * UI_LAYOUT.noteSpacing;
          const clickAreaTop = noteY - UI_LAYOUT.noteIconSize / 2 - 5;
          const clickAreaBottom = noteY + UI_LAYOUT.noteIconSize / 2 + 15;

          if (y >= clickAreaTop && y <= clickAreaBottom) {
            uiState.selectedNote = note;
            player.updateNoteValue();
            console.log(`Player note changed to: ${note}`);
          }
        });

        // Check mute button click
        const muteX = 10;
        const muteY = UI_LAYOUT.muteButtonY;
        if (x >= muteX && x <= muteX + UI_LAYOUT.muteButtonWidth &&
            y >= muteY && y <= muteY + UI_LAYOUT.muteButtonHeight) {
          uiState.isMuted = audio.toggleMute();
          console.log(`Audio ${uiState.isMuted ? 'muted' : 'unmuted'}`);
        }
      }
    };

    const handleKeyDown = (e) => {
      // Initialize audio context on first user interaction
      if (audio.context && audio.context.state === 'suspended') {
        audio.context.resume();
      }

      // Handle note keys (C, D, E, F, G, A, B)
      const noteGridYValues = NOTE_KEY_MAP[e.key.toLowerCase()];
      if (noteGridYValues !== undefined) {
        // Mark that a note key is being pressed
        gameState.isNoteKeyPressed = true;

        // Find the Y position with an actual obstacle
        const gridYArray = Array.isArray(noteGridYValues) ? noteGridYValues : [noteGridYValues];
        let targetGridY = gridYArray[0]; // Default to first value

        // Find obstacles at any of the note's Y positions
        const obstaclesAtNote = obstacles.filter(obs => {
          const obsGridY = (obs.pixelY / CONFIG.GRID_SIZE).toFixed(1);
          return gridYArray.some(gridY => Math.abs(gridY - parseFloat(obsGridY)) < 0.1);
        });

        // If there are obstacles, use the Y position of the closest one
        if (obstaclesAtNote.length > 0) {
          const closestObstacle = obstaclesAtNote.reduce((closest, current) => {
            return current.pixelX > closest.pixelX ? current : closest;
          });
          targetGridY = closestObstacle.pixelY / CONFIG.GRID_SIZE;
        }

        gameState.currentNoteGridY = targetGridY;

        // Call handleNoteKeyPress once with all possible Y values for this key
        handleNoteKeyPress(noteGridYValues);
        e.preventDefault();
        return;
      }

      // Handle restart key
      if ((e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'R') && gameState.isGameOver) {
        restartGame();
        return;
      }
    };

    const handleKeyUp = (e) => {
      // Handle note keys (C, D, E, F, G, A, B)
      const noteGridYValues = NOTE_KEY_MAP[e.key.toLowerCase()];
      if (noteGridYValues !== undefined) {
        // Mark that the note key is no longer pressed
        gameState.isNoteKeyPressed = false;
        gameState.currentNoteGridY = null;
        e.preventDefault();
      }
    };

    canvas.addEventListener("click", handleCanvasClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Store handlers for cleanup
    return { handleKeyDown, handleKeyUp };
  };

  /**
   * Restart the game
   */
  const restartGame = () => {
    // Reset lives
    lives.reset();

    // Reset score
    score.reset();

    // Clear game over state
    gameState.isGameOver = false;
    gameState.hasStarted = true; // Keep game started on restart

    // Clear obstacles
    obstacles.length = 0;

    // Reset player position
    player.pixelX = CONFIG.PLAYER_INITIAL_GRID_X * CONFIG.GRID_SIZE;
    player.pixelY = CONFIG.PLAYER_INITIAL_GRID_Y * CONFIG.GRID_SIZE;

    // Reset movement state
    movement.isMoving = false;
    movement.moveProgress = 0;
    movement.nextPixelX = null;
    movement.nextPixelY = null;

    // Reset animations
    playerAnimation.isAnimating = false;
    playerAnimation.progress = 0;
    noteDisplay.noteName = null;
    noteDisplay.displayTime = 0;

    // Reset obstacle spawner
    obstacleSpawner.timeSinceLastSpawn = 0;

    console.log('Game state reset');
  };

  /**
   * Load all monster images for obstacles
   */
  const loadMonsterImages = async () => {
    const monsterImages = new Set();
    obstacles.forEach((obs) => {
      if (obs.imagePath) monsterImages.add(obs.imagePath);
    });

    obstacleSpawner.monsterImages.forEach((path) => {
      monsterImages.add(path);
    });

    const imagePromises = Array.from(monsterImages).map(
      (imagePath) =>
        new Promise((resolve) => {
          const img = new Image();
          img.src = imagePath;
          img.onload = () => {
            // Store the image in all obstacles that use it
            obstacles.forEach((obs) => {
              if (obs.imagePath === imagePath) {
                obs.image = img;
              }
            });
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load image: ${imagePath}`);
            resolve();
          };
        })
    );

    return Promise.all(imagePromises);
  };

  /**
   * Load player image
   */
  const loadPlayerImage = async () => {
    return new Promise((resolve) => {
      if (!player.imagePath) {
        resolve();
        return;
      }

      const img = new Image();
      img.src = player.imagePath;
      img.onload = () => {
        player.image = img;
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load player image: ${player.imagePath}`);
        resolve();
      };
    });
  };

  /**
   * Load UI note images
   */
  const loadUIImages = async () => {
    const notes = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
    const promises = notes.map(note =>
      new Promise((resolve) => {
        const img = new Image();
        img.src = getPlayerNoteIcon(note);
        img.onload = () => {
          uiState.noteImages[note] = img;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load UI image for ${note}`);
          resolve();
        };
      })
    );
    return Promise.all(promises);
  };

  /**
   * Load treble clef image
   */
  const loadTrebleClefImage = async () => {
    return new Promise((resolve) => {
      if (!trebleClef.imagePath) {
        resolve();
        return;
      }

      const img = new Image();
      img.src = trebleClef.imagePath;
      img.onload = () => {
        trebleClef.image = img;
        resolve();
      };
      img.onerror = () => {
        console.warn(
          `Failed to load treble clef image: ${trebleClef.imagePath}`
        );
        resolve();
      };
    });
  };

  /**
   * Cache for loaded monster images
   */
  const imageCache = {};

  /**
   * Initialize the game
   */
  const init = async () => {
    console.log("Game init started...");

    canvas = document.getElementById("game");

    if (!canvas) {
      console.error(
        "Canvas element not found! Make sure your HTML has an element with id='game'"
      );
      return false;
    }

    // Get 2D context for drawing
    ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Failed to get 2D context from canvas");
      return false;
    }

    // Load monster images
    await loadMonsterImages();

    // Load player image
    await loadPlayerImage();

    // Load treble clef image
    await loadTrebleClefImage();

    // Load UI images
    await loadUIImages();

    // Preload all monster images for spawned obstacles
    await Promise.all(
      obstacleSpawner.monsterImages.map(
        (imagePath) =>
          new Promise((resolve) => {
            const img = new Image();
            img.src = imagePath;
            img.onload = () => {
              imageCache[imagePath] = img;
              resolve();
            };
            img.onerror = () => {
              console.warn(`Failed to preload image: ${imagePath}`);
              resolve();
            };
          })
      )
    );

    // Setup input handlers
    setupInputHandlers();

    // Initialize audio context
    audio.init();

    console.log("Game initialized successfully");
    return true;
  };

  // Initialize and start the game
  init().then((isReady) => {
    if (isReady) {
      requestAnimationFrame(loop);
    } else {
      console.error("Game failed to initialize");
    }
  });
};

// Start the game when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => main());
} else {
  main();
}
