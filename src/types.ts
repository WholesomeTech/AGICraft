/**
 * Block type enumeration
 */
export enum BlockType {
    AIR = 0,
    GRASS = 1,
    DIRT = 2,
    STONE = 3,
}

/**
 * Chunk dimensions
 */
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 16;

/**
 * Block face indices for cube
 */
export enum Face {
    FRONT = 0,
    BACK = 1,
    TOP = 2,
    BOTTOM = 3,
    LEFT = 4,
    RIGHT = 5,
}

/**
 * Block color palette (RGB)
 */
export const BLOCK_COLORS: Record<BlockType, [number, number, number]> = {
    [BlockType.AIR]: [0, 0, 0],
    [BlockType.GRASS]: [0.2, 0.8, 0.2],
    [BlockType.DIRT]: [0.5, 0.3, 0.1],
    [BlockType.STONE]: [0.5, 0.5, 0.5],
};

/**
 * Face normals for lighting
 */
export const FACE_NORMALS: [number, number, number][] = [
    [0, 0, 1],   // FRONT
    [0, 0, -1],  // BACK
    [0, 1, 0],   // TOP
    [0, -1, 0],  // BOTTOM
    [-1, 0, 0],  // LEFT
    [1, 0, 0],   // RIGHT
];

/**
 * Vertex data for each face of a cube (positions relative to block origin)
 */
export const CUBE_VERTICES: Record<Face, number[]> = {
    [Face.FRONT]: [
        0, 0, 1,  1, 0, 1,  1, 1, 1,
        0, 0, 1,  1, 1, 1,  0, 1, 1,
    ],
    [Face.BACK]: [
        1, 0, 0,  0, 0, 0,  0, 1, 0,
        1, 0, 0,  0, 1, 0,  1, 1, 0,
    ],
    [Face.TOP]: [
        0, 1, 0,  1, 1, 0,  1, 1, 1,
        0, 1, 0,  1, 1, 1,  0, 1, 1,
    ],
    [Face.BOTTOM]: [
        0, 0, 1,  1, 0, 1,  1, 0, 0,
        0, 0, 1,  1, 0, 0,  0, 0, 0,
    ],
    [Face.LEFT]: [
        0, 0, 0,  0, 0, 1,  0, 1, 1,
        0, 0, 0,  0, 1, 1,  0, 1, 0,
    ],
    [Face.RIGHT]: [
        1, 0, 1,  1, 0, 0,  1, 1, 0,
        1, 0, 1,  1, 1, 0,  1, 1, 1,
    ],
};
