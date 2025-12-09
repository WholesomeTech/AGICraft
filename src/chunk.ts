import { BlockType, CHUNK_SIZE, CHUNK_HEIGHT, Face, BLOCK_COLORS, FACE_NORMALS, CUBE_VERTICES } from './types.js';
import { SimplexNoise } from './noise.js';

/**
 * Represents a chunk of voxel data with greedy meshing
 */
export class Chunk {
    blocks: Uint8Array;
    vertices: Float32Array | null = null;
    vertexCount: number = 0;
    isDirty: boolean = true;
    private static noise = new SimplexNoise();

    constructor(public x: number, public z: number) {
        // Initialize block data (flattened 3D array)
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.generate();
    }

    /**
     * Get block at local coordinates
     */
    getBlock(x: number, y: number, z: number): BlockType {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return BlockType.AIR;
        }
        const index = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
        return this.blocks[index];
    }

    /**
     * Set block at local coordinates
     */
    setBlock(x: number, y: number, z: number, type: BlockType): void {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return;
        }
        const index = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
        this.blocks[index] = type;
        this.isDirty = true;
    }

    /**
     * Generate terrain with caves and ores
     */
    generate(): void {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = this.x * CHUNK_SIZE + x;
                const worldZ = this.z * CHUNK_SIZE + z;
                
                // Base terrain height (simple 2D noise approximation)
                // Use the 3D noise function at y=0 or simple math for 2D heightmap
                // Scale coordinate for noise
                const scale = 0.02;
                const hNoise = Chunk.noise.noise3D(worldX * scale, 0, worldZ * scale); 
                const height = Math.floor(32 + hNoise * 10); // Base height around 32, variation +/- 10
                
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    // Cave generation using 3D noise
                    // If noise value is below a threshold, it's a cave (AIR)
                    const caveScale = 0.05;
                    const caveNoise = Chunk.noise.noise3D(worldX * caveScale, y * caveScale, worldZ * caveScale);
                    const isCave = caveNoise < -0.3; // Threshold for caves

                    let blockType = BlockType.AIR;

                    if (!isCave) {
                        if (y <= height) {
                            if (y === height) {
                                blockType = BlockType.GRASS;
                            } else if (y > height - 4) {
                                blockType = BlockType.DIRT;
                            } else {
                                blockType = BlockType.STONE;
                                
                                // Ores
                                if (Math.random() < 0.05) blockType = BlockType.COAL_ORE;
                                else if (y < 20 && Math.random() < 0.03) blockType = BlockType.IRON_ORE;
                                else if (y < 10 && Math.random() < 0.01) blockType = BlockType.DIAMOND_ORE;
                            }
                        } else if (y === height + 1 && Math.random() < 0.005) {
                            // Simple Trees (just a log for now, full tree generation requires neighbor access or multi-pass)
                            // blockType = BlockType.WOOD; 
                            // Let's create a simple 1-block stump to indicate tree for now
                            // Properly generating trees across chunk boundaries is complex.
                             this.generateSimpleTree(x, y, z);
                        }
                    }
                    
                    if (blockType !== BlockType.AIR) {
                        this.setBlock(x, y, z, blockType);
                    }
                }
            }
        }
        this.isDirty = true;
    }

    private generateSimpleTree(x: number, y: number, z: number) {
        // Simple "tree": 3 blocks of wood, some leaves on top
        // Careful with bounds checks!
        for (let i = 0; i < 4; i++) {
             this.setBlock(x, y + i, z, BlockType.WOOD);
        }
        // Leaves
        for (let lx = -1; lx <= 1; lx++) {
            for (let lz = -1; lz <= 1; lz++) {
                 this.setBlock(x + lx, y + 3, z + lz, BlockType.LEAVES);
                 this.setBlock(x + lx, y + 4, z + lz, BlockType.LEAVES);
            }
        }
        this.setBlock(x, y + 5, z, BlockType.LEAVES);
    }

    /**
     * Check if a block face should be rendered (is exposed to air)
     */
    private shouldRenderFace(x: number, y: number, z: number, face: Face): boolean {
        const block = this.getBlock(x, y, z);
        if (block === BlockType.AIR) return false;

        let nx = x, ny = y, nz = z;
        
        switch (face) {
            case Face.FRONT: nz++; break;
            case Face.BACK: nz--; break;
            case Face.TOP: ny++; break;
            case Face.BOTTOM: ny--; break;
            case Face.LEFT: nx--; break;
            case Face.RIGHT: nx++; break;
        }

        const neighbor = this.getBlock(nx, ny, nz);
        return neighbor === BlockType.AIR;
    }

    /**
     * Greedy meshing algorithm to reduce triangle count
     * Merges adjacent quads of the same block type and face direction
     */
    buildMesh(): void {
        const vertices: number[] = [];
        
        // For each face direction
        for (let face = 0; face < 6; face++) {
            const [du, dv] = this.getFaceAxes(face);
            const [nx, ny, nz] = FACE_NORMALS[face];
            
            // Create a 2D grid for this face direction
            const dims = this.getFaceDimensions(face);
            const [width, height] = dims;
            
            // Scan through each slice perpendicular to the face normal
            for (let d = 0; d < CHUNK_HEIGHT; d++) {
                const mask: (BlockType | null)[] = new Array(width * height).fill(null);
                
                // Build mask for this slice
                for (let v = 0; v < height; v++) {
                    for (let u = 0; u < width; u++) {
                        const [x, y, z] = this.getCoords(u, v, d, face);
                        
                        if (this.shouldRenderFace(x, y, z, face)) {
                            mask[u + v * width] = this.getBlock(x, y, z);
                        }
                    }
                }
                
                // Generate mesh from mask using greedy algorithm
                for (let v = 0; v < height; v++) {
                    for (let u = 0; u < width;) {
                        const blockType = mask[u + v * width];
                        
                        if (blockType === null) {
                            u++;
                            continue;
                        }
                        
                        // Compute width of this quad
                        let w = 1;
                        while (u + w < width && mask[u + w + v * width] === blockType) {
                            w++;
                        }
                        
                        // Compute height of this quad
                        let h = 1;
                        let done = false;
                        while (v + h < height && !done) {
                            for (let k = 0; k < w; k++) {
                                if (mask[u + k + (v + h) * width] !== blockType) {
                                    done = true;
                                    break;
                                }
                            }
                            if (!done) h++;
                        }
                        
                        // Add quad to mesh
                        this.addQuad(vertices, u, v, d, w, h, face, blockType);
                        
                        // Clear mask for processed area
                        for (let l = 0; l < h; l++) {
                            for (let k = 0; k < w; k++) {
                                mask[u + k + (v + l) * width] = null;
                            }
                        }
                        
                        u += w;
                    }
                }
            }
        }
        
        this.vertices = new Float32Array(vertices);
        this.vertexCount = vertices.length / 6; // position(3) + color(3)
        this.isDirty = false;
    }

    /**
     * Add a quad (two triangles) to the vertex array
     */
    private addQuad(
        vertices: number[],
        u: number,
        v: number,
        d: number,
        w: number,
        h: number,
        face: Face,
        blockType: BlockType
    ): void {
        const [x, y, z] = this.getCoords(u, v, d, face);
        const color = BLOCK_COLORS[blockType];
        const [nx, ny, nz] = FACE_NORMALS[face];
        
        // Calculate lighting based on face normal (simple ambient occlusion)
        const brightness = 0.5 + (ny * 0.3) + 0.2;
        const r = color[0] * brightness;
        const g = color[1] * brightness;
        const b = color[2] * brightness;
        
        // Get axis vectors for this face
        const [du, dv] = this.getFaceAxes(face);
        
        // Calculate quad corners
        const corners = this.getQuadCorners(x, y, z, w, h, face);

        // Apply world offset to vertices
        const worldOffsetX = this.x * CHUNK_SIZE;
        const worldOffsetZ = this.z * CHUNK_SIZE;
        for (let i = 0; i < corners.length; i += 3) {
            corners[i] += worldOffsetX;
            corners[i + 2] += worldOffsetZ;
        }
        
        // Add two triangles (6 vertices)
        // Triangle 1: v0, v1, v2
        vertices.push(corners[0], corners[1], corners[2], r, g, b);
        vertices.push(corners[3], corners[4], corners[5], r, g, b);
        vertices.push(corners[6], corners[7], corners[8], r, g, b);
        
        // Triangle 2: v0, v2, v3
        vertices.push(corners[0], corners[1], corners[2], r, g, b);
        vertices.push(corners[6], corners[7], corners[8], r, g, b);
        vertices.push(corners[9], corners[10], corners[11], r, g, b);
    }

    /**
     * Get quad corners for a face
     */
    private getQuadCorners(x: number, y: number, z: number, w: number, h: number, face: Face): number[] {
        const offset = [x, y, z];
        
        switch (face) {
            case Face.FRONT:
                return [
                    offset[0], offset[1], offset[2] + 1,
                    offset[0] + w, offset[1], offset[2] + 1,
                    offset[0] + w, offset[1] + h, offset[2] + 1,
                    offset[0], offset[1] + h, offset[2] + 1,
                ];
            case Face.BACK:
                return [
                    offset[0] + w, offset[1], offset[2],
                    offset[0], offset[1], offset[2],
                    offset[0], offset[1] + h, offset[2],
                    offset[0] + w, offset[1] + h, offset[2],
                ];
            case Face.TOP:
                return [
                    offset[0], offset[1] + 1, offset[2] + h,
                    offset[0] + w, offset[1] + 1, offset[2] + h,
                    offset[0] + w, offset[1] + 1, offset[2],
                    offset[0], offset[1] + 1, offset[2],
                ];
            case Face.BOTTOM:
                return [
                    offset[0], offset[1], offset[2],
                    offset[0] + w, offset[1], offset[2],
                    offset[0] + w, offset[1], offset[2] + h,
                    offset[0], offset[1], offset[2] + h,
                ];
            case Face.LEFT:
                return [
                    offset[0], offset[1], offset[2],
                    offset[0], offset[1], offset[2] + w,
                    offset[0], offset[1] + h, offset[2] + w,
                    offset[0], offset[1] + h, offset[2],
                ];
            case Face.RIGHT:
                return [
                    offset[0] + 1, offset[1], offset[2] + w,
                    offset[0] + 1, offset[1], offset[2],
                    offset[0] + 1, offset[1] + h, offset[2],
                    offset[0] + 1, offset[1] + h, offset[2] + w,
                ];
        }
    }

    /**
     * Get face axes for sweeping
     */
    private getFaceAxes(face: Face): [number[], number[]] {
        switch (face) {
            case Face.FRONT:
            case Face.BACK:
                return [[1, 0, 0], [0, 1, 0]];
            case Face.TOP:
            case Face.BOTTOM:
                return [[1, 0, 0], [0, 0, 1]];
            case Face.LEFT:
            case Face.RIGHT:
                return [[0, 0, 1], [0, 1, 0]];
        }
    }

    /**
     * Get dimensions for face grid
     */
    private getFaceDimensions(face: Face): [number, number] {
        switch (face) {
            case Face.FRONT:
            case Face.BACK:
                return [CHUNK_SIZE, CHUNK_HEIGHT];
            case Face.TOP:
            case Face.BOTTOM:
                return [CHUNK_SIZE, CHUNK_SIZE];
            case Face.LEFT:
            case Face.RIGHT:
                return [CHUNK_SIZE, CHUNK_HEIGHT];
        }
    }

    /**
     * Convert (u, v, d) coordinates to (x, y, z) based on face direction
     */
    private getCoords(u: number, v: number, d: number, face: Face): [number, number, number] {
        switch (face) {
            case Face.FRONT:
                return [u, v, d];
            case Face.BACK:
                return [u, v, CHUNK_SIZE - 1 - d];
            case Face.TOP:
                return [u, d, v];
            case Face.BOTTOM:
                return [u, CHUNK_HEIGHT - 1 - d, v];
            case Face.LEFT:
                return [d, v, u];
            case Face.RIGHT:
                return [CHUNK_SIZE - 1 - d, v, u];
            default:
                return [0, 0, 0];
        }
    }
}
