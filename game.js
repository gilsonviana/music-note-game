const obstacleGenerator = (pixelX = 0, pixelY = 0, imagePath = null, speed = 100) => {
  return {
    pixelX,
    pixelY,
    imagePath,
    image: null,
    speed,
    hasBeenAvoided: false, // Track if player has avoided this obstacle
    hasCollided: false, // Track if player has collided with this obstacle
  };
};

const main = (debug = false) => {
  // DOM and Canvas elements
  let canvas, ctx;
  let lastTime = 0;

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
      'assets/MonsterIcons/monster.png',
      'assets/MonsterIcons/monster (1).png',
      'assets/MonsterIcons/monster (2).png',
      'assets/MonsterIcons/monster (3).png',
    ],
    currentImageIndex: 0,
    getNextImage() {
      const img = this.monsterImages[this.currentImageIndex];
      this.currentImageIndex = (this.currentImageIndex + 1) % this.monsterImages.length;
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

    return obstacles.find(
      (obs) =>
        Math.abs(obs.pixelX - pixelX) < tolerance &&
        Math.abs(obs.pixelY - pixelY) < tolerance
    ) || null;
  };

  /**
   * Check if player is currently colliding with any obstacle
   */
  const checkPlayerCollisions = () => {
    const playerGridX = player.gridX;
    const playerGridY = player.gridY;
    const playerPixelX = player.getPixelX();
    const playerPixelY = player.getPixelY();

    obstacles.forEach((obs) => {
      // Check if obstacle overlaps with player position
      const dx = Math.abs(playerPixelX + CONFIG.PLAYER_SIZE / 2 - (obs.pixelX + CONFIG.GRID_SIZE / 2));
      const dy = Math.abs(playerPixelY + CONFIG.PLAYER_SIZE / 2 - (obs.pixelY + CONFIG.GRID_SIZE / 2));

      const collision = dx < CONFIG.PLAYER_SIZE && dy < CONFIG.PLAYER_SIZE;

      if (collision && !obs.hasCollided) {
        obs.hasCollided = true;
        score.collision();
      }
    });
  };

  // Player object
  const player = {
    color: '#4CAF50',
    pixelX: CONFIG.PLAYER_INITIAL_GRID_X * CONFIG.GRID_SIZE,
    pixelY: CONFIG.PLAYER_INITIAL_GRID_Y * CONFIG.GRID_SIZE,
    size: CONFIG.PLAYER_SIZE,
    imagePath: 'assets/MusicIcons/half-note.png',
    image: null,
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
        return this.pixelX + (movement.nextPixelX - this.pixelX) * movement.moveProgress;
      }
      return this.pixelX;
    },
    getPixelY() {
      if (movement.isMoving && movement.nextPixelY !== null) {
        return this.pixelY + (movement.nextPixelY - this.pixelY) * movement.moveProgress;
      }
      return this.pixelY;
    },
  };

  // Treble clef object
  const trebleClef = {
    imagePath: 'assets/MusicIcons/treble-clef.png',
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
    // Spawn new obstacles
    obstacleSpawner.timeSinceLastSpawn += delta;
    if (obstacleSpawner.timeSinceLastSpawn >= CONFIG.OBSTACLE_SPAWN_INTERVAL) {
      obstacleSpawner.timeSinceLastSpawn = 0;
      const imagePath = obstacleSpawner.getNextImage();
      // Random Y position between grid 5 and 9 (inclusive)
      const randomGridY = 5 + Math.floor(Math.random() * 5); // 5, 6, 7, 8, or 9
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
      // Check if player missed the obstacle
      score.checkMiss(obs, player.pixelX);
    });

    // Remove obstacles that went off-screen
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (obstacles[i].pixelX + CONFIG.GRID_SIZE < 0) {
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
      ctx.drawImage(trebleClef.image, trebleClef.x, trebleClef.y, trebleClef.width, trebleClef.height);
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
      for (let y = CONFIG.GRID_SIZE / 2; y <= canvas.height; y += CONFIG.GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw player at interpolated position
    if (player.image && player.image.complete) {
      // Draw the player image
      ctx.drawImage(
        player.image,
        player.getPixelX(),
        player.getPixelY(),
        player.size,
        player.size
      );
    } else {
      // Fallback to colored square if image not loaded
      ctx.fillStyle = player.color;
      ctx.fillRect(
        player.getPixelX(),
        player.getPixelY(),
        player.size,
        player.size
      );
    }

    // Draw obstacles
    obstacles.forEach((obs) => {
      if (obs.image && obs.image.complete) {
        // Draw the monster image
        ctx.drawImage(obs.image, obs.pixelX, obs.pixelY, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
      } else {
        // Fallback to colored square if image not loaded
        ctx.fillStyle = "#FF6B6B";
        ctx.fillRect(obs.pixelX, obs.pixelY, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
      }
    });

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
      ctx.fillText(`Grid: (${player.gridX}, ${player.gridY})`, 10, 20);
      ctx.fillText(
        `Pixel: (${Math.round(player.getPixelX())}, ${Math.round(
          player.getPixelY()
        )})`,
        10,
        35
      );
      ctx.fillText(`Moving: ${movement.isMoving}`, 10, 50);
      ctx.fillText(`Obstacles: ${obstacles.length}`, 10, 65);
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
        console.warn(`Failed to load treble clef image: ${trebleClef.imagePath}`);
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
  document.addEventListener("DOMContentLoaded", () => main(true));
} else {
  main(true);
}
