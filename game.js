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
    const radio = document.querySelector('input[name="player-note"]:checked');
    return radio ? radio.value : 'half';
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
    PLAYER_INITIAL_GRID_Y: 7,
    OBSTACLE_SPEED: 150, // pixels per second (moving left)
    OBSTACLE_SPAWN_INTERVAL: 2, // seconds between spawning obstacles
    OBSTACLE_SPAWN_Y: 5, // Grid Y position where obstacles spawn
    COLLISION_POINTS_GAINED: 100, // Points gained on collision
    MISS_POINTS_LOST: -50, // Points lost for missing an obstacle
    ENABLE_X_AXIS_MOVEMENT: false, // Enable/disable left-right movement
    BPM: 90, // Beats per minute (4/4 time signature)
  };

  // Input state
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  // Movement state
  const movement = {
    isMoving: false,
    moveProgress: 0, // 0 to 1, how far through current move we are
    nextPixelX: null,
    nextPixelY: null,
  };

  // Key to action mapping
  const KEY_MAP = {
    w: "up",
    arrowup: "up",
    s: "down",
    arrowdown: "down",
    a: "left",
    arrowleft: "left",
    d: "right",
    arrowright: "right",
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
     * Check if player has missed an obstacle
     */
    checkMiss(obstacle, playerX) {
      // If obstacle has passed the player's position and hasn't been hit
      if (
        obstacle.pixelX < playerX &&
        !obstacle.hasBeenAvoided &&
        !obstacle.hasCollided
      ) {
        obstacle.hasBeenAvoided = true;
        this.addPoints(CONFIG.MISS_POINTS_LOST);
        return true;
      }
      return false;
    },
    /**
     * Register a collision with an obstacle
     */
    collision() {
      this.addPoints(CONFIG.COLLISION_POINTS_GAINED);
    },
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
        score.collision();

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
    width: 2 * CONFIG.GRID_SIZE, // Width: 2 grid cells
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
      const newObstacle = obstacleGenerator(
        canvas.width,
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
      // Check if player missed the obstacle
      score.checkMiss(obs, player.pixelX);
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

    // Handle input to start new movement if not already moving
    if (!movement.isMoving) {
      let newPixelX = player.pixelX;
      let newPixelY = player.pixelY;
      let isMoving = false;
      const HALF_GRID = CONFIG.GRID_SIZE / 2; // 16 pixels

      // Prioritize: no diagonal movement in grid-based games
      if (input.up) {
        newPixelY = Math.max(0, player.pixelY - HALF_GRID);
        isMoving = true;
      } else if (input.down) {
        const maxPixelY = canvas.height - CONFIG.PLAYER_SIZE;
        newPixelY = Math.min(maxPixelY, player.pixelY + HALF_GRID);
        isMoving = true;
      } else if (input.left && CONFIG.ENABLE_X_AXIS_MOVEMENT) {
        newPixelX = Math.max(0, player.pixelX - HALF_GRID);
        isMoving = true;
      } else if (input.right && CONFIG.ENABLE_X_AXIS_MOVEMENT) {
        const maxPixelX = canvas.width - CONFIG.PLAYER_SIZE;
        newPixelX = Math.min(maxPixelX, player.pixelX + HALF_GRID);
        isMoving = true;
      }

      // Start movement if input detected and position changed
      if (
        isMoving &&
        (newPixelX !== player.pixelX || newPixelY !== player.pixelY)
      ) {
        const targetGridX = Math.round(newPixelX / CONFIG.GRID_SIZE);
        const targetGridY = Math.round(newPixelY / CONFIG.GRID_SIZE);
        const obstacle = getObstacleAt(targetGridX, targetGridY);

        if (obstacle) {
          // There's an obstacle at the target position, register collision
          if (!obstacle.hasCollided) {
            obstacle.hasCollided = true;
            score.collision();
          }
        }

        // Move the player regardless of obstacles
        movement.isMoving = true;
        movement.moveProgress = 0;
        movement.nextPixelX = newPixelX;
        movement.nextPixelY = newPixelY;
      }
    }
  };

  /**
   * Render the game scene
   */
  const render = () => {
    // Clear canvas with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw 5 horizontal background lines spaced by grid size, centered vertically
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    const totalLineHeight = 4 * CONFIG.GRID_SIZE; // 4 gaps between 5 lines
    const startY = (canvas.height - totalLineHeight) / 2;
    for (let i = 0; i < 5; i++) {
      const y = startY + i * CONFIG.GRID_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
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

    // Draw player at interpolated position
    const scale = playerAnimation.getScale();
    const shake = playerAnimation.getShake();
    const playerX = player.getPixelX() + shake.x;
    const playerY = player.getPixelY() + shake.y;

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
      ctx.fillText(noteDisplay.noteName, canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }

    // Draw score
    ctx.fillStyle = score.current < 0 ? "#FF0000" : "#000000";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`Score: ${score.current}`, canvas.width - 20, 30);
    ctx.textAlign = "left";

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

    update(cappedDelta);
    render();

    requestAnimationFrame(loop);
  };

  /**
   * Setup event listeners for input handling
   */
  const setupInputHandlers = () => {
    const handleKeyDown = (e) => {
      const action = KEY_MAP[e.key.toLowerCase()];
      if (action) {
        input[action] = true;
        e.preventDefault(); // Prevent page scroll
      }
    };

    const handleKeyUp = (e) => {
      const action = KEY_MAP[e.key.toLowerCase()];
      if (action) {
        input[action] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Setup player note selector listeners
    const playerNoteRadios = document.querySelectorAll('input[name="player-note"]');
    playerNoteRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        player.updateNoteValue();
        console.log(`Player note changed to: ${e.target.value}`);
      });
    });

    // Setup mute button listener
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = audio.toggleMute();
        muteBtn.classList.toggle('muted', isMuted);
        muteBtn.textContent = isMuted ? '🔇 Unmute' : '🔊 Mute';
        console.log(`Audio ${isMuted ? 'muted' : 'unmuted'}`);
      });
    }

    // Store handlers for cleanup
    return { handleKeyDown, handleKeyUp };
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
