import { Leaf, MAX_LEAF_SIZE, Rect } from './Leaf';

export const TILE_SIZE = 16;

// Tile indices inside tileset.png (128x64 = 8 cols x 4 rows of 16x16 tiles).
const WALL_TILE = 1;
const FLOOR_TILE = 0;
const FLOOR_VARIANTS = [16, 17, 18, 20, 21, 22, 23];

export interface WallSegment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface Dungeon {
    widthInTiles: number;
    heightInTiles: number;
    tiles: number[][]; // tile index to render, [y][x]
    wallSegments: WallSegment[];
    isFloor(tileX: number, tileY: number): boolean;
    // World-space centre of a starting room, so the lamp never starts out
    // standing in solid rock.
    startX: number;
    startY: number;
}

class Grid {
    width: number;
    height: number;
    cells: Uint8Array;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.cells = new Uint8Array(width * height);
    }

    get(x: number, y: number): number {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
        return this.cells[y * this.width + x];
    }

    set(x: number, y: number, value: number): void {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
        this.cells[y * this.width + x] = value;
    }

    fillRect(r: Rect): void {
        const x0 = Math.max(0, Math.floor(r.x));
        const y0 = Math.max(0, Math.floor(r.y));
        const x1 = Math.min(this.width, Math.ceil(r.x + r.width));
        const y1 = Math.min(this.height, Math.ceil(r.y + r.height));
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                this.set(x, y, 1);
            }
        }
    }
}

export function generateDungeon(widthInTiles: number, heightInTiles: number): Dungeon {
    const grid = new Grid(widthInTiles, heightInTiles);
    const leafs: Leaf[] = [];

    const root = new Leaf(0, 0, widthInTiles, heightInTiles);
    leafs.push(root);

    let didSplit = true;
    while (didSplit) {
        didSplit = false;
        for (const leaf of leafs) {
            if (!leaf.leftChild && !leaf.rightChild) {
                if (leaf.width > MAX_LEAF_SIZE || leaf.height > MAX_LEAF_SIZE || Math.random() > 0.25) {
                    if (leaf.split()) {
                        leafs.push(leaf.leftChild!);
                        leafs.push(leaf.rightChild!);
                        didSplit = true;
                    }
                }
            }
        }
    }

    root.createRooms();

    for (const leaf of leafs) {
        if (leaf.room) {
            grid.fillRect(leaf.room);
        }
        if (leaf.halls && leaf.halls.length > 0) {
            for (const hall of leaf.halls) {
                grid.fillRect(hall);
            }
        }
    }

    const wallSegments = findWallSegments(grid);
    const tiles = buildTileIndices(grid);

    const startRoom = leafs.find((leaf) => leaf.room)?.room;
    const startX = startRoom ? (startRoom.x + startRoom.width / 2) * TILE_SIZE : (widthInTiles * TILE_SIZE) / 2;
    const startY = startRoom ? (startRoom.y + startRoom.height / 2) * TILE_SIZE : (heightInTiles * TILE_SIZE) / 2;

    return {
        widthInTiles,
        heightInTiles,
        tiles,
        wallSegments,
        isFloor: (tileX, tileY) => grid.get(tileX, tileY) !== 0,
        startX,
        startY,
    };
}

// Scans horizontal/vertical runs along floor/wall boundaries and emits a
// line segment for each run, exactly like TestState.updateMap did.
function findWallSegments(grid: Grid): WallSegment[] {
    const segments: WallSegment[] = [];
    const { width, height } = grid;

    for (let y = 0; y < height; y++) {
        let runStart = 0;
        let up = 0;
        for (let x = 0; x < width; x++) {
            if (grid.get(x, y) !== 0 && grid.get(x, y - 1) === 0) {
                up++;
            } else {
                if (up >= 1) {
                    segments.push({ x1: runStart * TILE_SIZE, y1: y * TILE_SIZE, x2: (runStart + up) * TILE_SIZE, y2: y * TILE_SIZE });
                }
                runStart = x + 1;
                up = 0;
            }
        }

        runStart = 0;
        let down = 0;
        for (let x = 0; x < width; x++) {
            if (grid.get(x, y) !== 0 && grid.get(x, y + 1) === 0) {
                down++;
            } else {
                if (down >= 1) {
                    segments.push({ x1: runStart * TILE_SIZE, y1: (y + 1) * TILE_SIZE, x2: (runStart + down) * TILE_SIZE, y2: (y + 1) * TILE_SIZE });
                }
                runStart = x + 1;
                down = 0;
            }
        }
    }

    for (let x = 0; x < width; x++) {
        let runStart = 0;
        let left = 0;
        for (let y = 0; y < height; y++) {
            if (grid.get(x, y) !== 0 && grid.get(x - 1, y) === 0) {
                left++;
            } else {
                if (left >= 1) {
                    segments.push({ x1: x * TILE_SIZE, y1: runStart * TILE_SIZE, x2: x * TILE_SIZE, y2: (runStart + left) * TILE_SIZE });
                }
                runStart = y + 1;
                left = 0;
            }
        }

        runStart = 0;
        let right = 0;
        for (let y = 0; y < height; y++) {
            if (grid.get(x, y) !== 0 && grid.get(x + 1, y) === 0) {
                right++;
            } else {
                if (right >= 1) {
                    segments.push({ x1: (x + 1) * TILE_SIZE, y1: runStart * TILE_SIZE, x2: (x + 1) * TILE_SIZE, y2: (runStart + right) * TILE_SIZE });
                }
                runStart = y + 1;
                right = 0;
            }
        }
    }

    return segments;
}

function neighborBitmask(grid: Grid, x: number, y: number): number {
    let result = 0;
    if (grid.get(x + 1, y + 1) !== 0) result += 1;
    if (grid.get(x + 1, y) !== 0) result += 2;
    if (grid.get(x + 1, y - 1) !== 0) result += 4;
    if (grid.get(x, y - 1) !== 0) result += 8;
    if (grid.get(x - 1, y - 1) !== 0) result += 16;
    if (grid.get(x - 1, y) !== 0) result += 32;
    if (grid.get(x - 1, y + 1) !== 0) result += 64;
    if (grid.get(x, y + 1) !== 0) result += 128;
    return result;
}

function buildTileIndices(grid: Grid): number[][] {
    const tiles: number[][] = [];
    for (let y = 0; y < grid.height; y++) {
        const row: number[] = [];
        for (let x = 0; x < grid.width; x++) {
            if (grid.get(x, y) === 0) {
                row.push(WALL_TILE);
            } else if (neighborBitmask(grid, x, y) === 255) {
                row.push(FLOOR_TILE);
            } else {
                row.push(FLOOR_VARIANTS[Math.floor(Math.random() * FLOOR_VARIANTS.length)]);
            }
        }
        tiles.push(row);
    }
    return tiles;
}
