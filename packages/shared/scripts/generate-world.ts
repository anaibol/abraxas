import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function saveMap(name: string, data: any) {
  const path = resolve(__dirname, `../src/maps/${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`Generated ${name}.json`);
}

function generateArena() {
  const width = 200;
  const height = 200;
  const tileSize = 32;
  const collision: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
  const tileTypes: number[][] = Array.from({ length: height }, () => Array(width).fill(0));

  // Border walls
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        collision[y][x] = 1;
        tileTypes[y][x] = 1;
      } else {
        // Random trees
        if (Math.random() < 0.05) {
          collision[y][x] = 1;
          tileTypes[y][x] = 2;
        }
      }
    }
  }

  // Clear a town area
  const townX = 90;
  const townY = 90;
  const townW = 20;
  const townH = 20;

  for (let y = townY; y < townY + townH; y++) {
    for (let x = townX; x < townX + townW; x++) {
      collision[y][x] = 0;
      tileTypes[y][x] = 0;
    }
  }

  const npcs = [
    { type: "horse", x: 95, y: 95 },
    { type: "merchant", x: 100, y: 95 },
    { type: "banker", x: 105, y: 95 },
  ];

  // Define warps
  const warps = [{ x: 150, y: 150, targetMap: "catacombs", targetX: 5, targetY: 5 }];

  // Make area around warp clear
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      collision[150 + dy][150 + dx] = 0;
      tileTypes[150 + dy][150 + dx] = 0;
      // wall around it
      if (Math.abs(dy) === 2 || Math.abs(dx) === 2) {
        if (dy !== 2) {
          collision[150 + dy][150 + dx] = 1;
          tileTypes[150 + dy][150 + dx] = 1;
        }
      }
    }
  }

  // Draw some water near the edge
  for (let y = 10; y < 40; y++) {
    for (let x = 10; x < 40; x++) {
      const val = Math.random();
      if (val < 0.5) {
        collision[y][x] = 1;
        tileTypes[y][x] = 3; // Water
      } else if (val < 0.7) {
        collision[y][x] = 0;
        tileTypes[y][x] = 0;
      }
    }
  }

  saveMap("arena", {
    width,
    height,
    tileSize,
    collision,
    tileTypes,
    spawns: [{ x: 100, y: 100 }],
    newbieSpawns: [{ x: 100, y: 100 }],
    safeZones: [{ x: 90, y: 90, w: 20, h: 20 }],
    npcCount: 150,
    merchantCount: 5,
    npcs,
    warps,
  });
}

function generateCatacombs() {
  const width = 100;
  const height = 100;
  const tileSize = 32;
  const collision: number[][] = Array.from({ length: height }, () => Array(width).fill(1));
  const tileTypes: number[][] = Array.from({ length: height }, () => Array(width).fill(5)); // dark wall

  // Simple drunkard's walk for caves
  // Initialize random noise
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (Math.random() < 0.45) {
        collision[y][x] = 0;
        tileTypes[y][x] = 4; // dark stone floor
      }
    }
  }

  // Smooth
  for (let i = 0; i < 4; i++) {
    const nextCol = Array.from({ length: height }, () => Array(width).fill(1));
    const nextTyp = Array.from({ length: height }, () => Array(width).fill(5));
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let walls = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (collision[y + dy][x + dx] === 1) walls++;
          }
        }
        if (walls >= 5) {
          nextCol[y][x] = 1;
          nextTyp[y][x] = 5;
        } else {
          nextCol[y][x] = 0;
          nextTyp[y][x] = 4;
        }
      }
    }
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        collision[y][x] = nextCol[y][x];
        tileTypes[y][x] = nextTyp[y][x];
      }
    }
  }

  // Ensure start is clear
  for (let y = 2; y <= 8; y++) {
    for (let x = 2; x <= 8; x++) {
      collision[y][x] = 0;
      tileTypes[y][x] = 4;
    }
  }

  const npcs: any[] = [];
  const validCaveTiles: { x: number; y: number }[] = [];
  for (let y = 10; y < height - 10; y++) {
    for (let x = 10; x < width - 10; x++) {
      if (collision[y][x] === 0) {
        // Count neighbors to make sure it's somewhat open
        let walls = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (collision[y + dy][x + dx] === 1) walls++;
          }
        }
        if (walls <= 3) {
          validCaveTiles.push({ x, y });
        }
      }
    }
  }

  // Shuffle valid tiles
  validCaveTiles.sort(() => Math.random() - 0.5);

  const mobPool = [
    "skeleton",
    "zombie",
    "ghost",
    "spider",
    "skeleton_archer",
    "vampire",
    "gargoyle",
  ];

  // place random mobs
  for (let i = 0; i < 60; i++) {
    if (validCaveTiles.length === 0) break;
    const t = validCaveTiles.pop()!;
    const type = mobPool[Math.floor(Math.random() * mobPool.length)];
    npcs.push({ type, x: t.x, y: t.y });
  }

  // place bosses
  for (let i = 0; i < 2; i++) {
    if (validCaveTiles.length === 0) break;
    npcs.push({ type: "lich", ...validCaveTiles.pop()! });
    npcs.push({ type: "dark_knight", ...validCaveTiles.pop()! });
  }

  saveMap("catacombs", {
    width,
    height,
    tileSize,
    collision,
    tileTypes,
    spawns: [{ x: 5, y: 5 }],
    warps: [{ x: 4, y: 4, targetMap: "arena", targetX: 150, targetY: 151 }],
    npcs,
  });
}

generateArena();
generateCatacombs();
