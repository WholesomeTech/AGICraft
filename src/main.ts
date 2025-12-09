import { Camera } from './camera.js';
import { Chunk } from './chunk.js';
import { Renderer } from './renderer.js';
import { Vec3, Mat4 } from './math.js';
import { BlockType, CHUNK_SIZE, CHUNK_HEIGHT } from './types.js';

/**
 * Main application class
 */
class Game {
    private canvas: HTMLCanvasElement;
    private renderer: Renderer;
    private camera: Camera;
    private chunks: Map<string, Chunk> = new Map();
    
    private lastTime: number = 0;
    private isPointerLocked: boolean = false;
    private selectedBlock: BlockType = BlockType.STONE;
    
    constructor() {
        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        
        // Set initial canvas size
        this.resizeCanvas();
        
        // Initialize renderer
        this.renderer = new Renderer(this.canvas);
        
        // Initialize camera
        this.camera = new Camera(
            new Vec3(0, 10, 20),  // Starting position
            Math.PI / 3,          // 60 degree FOV
            this.canvas.width / this.canvas.height,
            0.1,                  // Near plane
            1000.0                // Far plane
        );
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Initialize the game
     */
    async init(): Promise<void> {
        try {
            await this.renderer.init();
            
            // Generate initial chunks
            this.generateChunks();
            
            // Start game loop
            this.lastTime = performance.now();
            requestAnimationFrame((time) => this.gameLoop(time));
            
            console.log('Game initialized successfully');
        } catch (error) {
            this.showError(`Initialization failed: ${error}`);
            throw error;
        }
    }

    /**
     * Generate chunks around origin
     */
    private generateChunks(): void {
        const renderDistance = 3; // Chunks in each direction
        
        for (let x = -renderDistance; x <= renderDistance; x++) {
            for (let z = -renderDistance; z <= renderDistance; z++) {
                const chunk = new Chunk(x, z);
                this.chunks.set(`${x},${z}`, chunk);
            }
        }
    }

    /**
     * Get chunk at chunk coordinates
     */
    private getChunk(cx: number, cz: number): Chunk | undefined {
        return this.chunks.get(`${cx},${cz}`);
    }

    /**
     * Get block at world coordinates
     */
    private getBlock(x: number, y: number, z: number): BlockType {
        if (y < 0 || y >= CHUNK_HEIGHT) return BlockType.AIR;
        
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        
        if (!chunk) return BlockType.AIR;
        
        const lx = (x % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = (z % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        
        return chunk.getBlock(lx, y, lz);
    }

    /**
     * Set block at world coordinates
     */
    private setBlock(x: number, y: number, z: number, type: BlockType): void {
        if (y < 0 || y >= CHUNK_HEIGHT) return;
        
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        
        if (!chunk) return;
        
        const lx = (x % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = (z % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        
        chunk.setBlock(lx, y, lz, type);
        chunk.buildMesh();
        this.renderer.updateChunk(chunk);
    }

    /**
     * Raycast into the world
     */
    private raycast(origin: Vec3, direction: Vec3, maxDistance: number): { position: Vec3, normal: Vec3 } | null {
        let t = 0;
        let x = Math.floor(origin.x);
        let y = Math.floor(origin.y);
        let z = Math.floor(origin.z);

        const stepX = direction.x > 0 ? 1 : -1;
        const stepY = direction.y > 0 ? 1 : -1;
        const stepZ = direction.z > 0 ? 1 : -1;

        const deltaX = Math.abs(1 / direction.x);
        const deltaY = Math.abs(1 / direction.y);
        const deltaZ = Math.abs(1 / direction.z);

        const distX = stepX > 0 ? (Math.floor(origin.x) + 1 - origin.x) : (origin.x - Math.floor(origin.x));
        const distY = stepY > 0 ? (Math.floor(origin.y) + 1 - origin.y) : (origin.y - Math.floor(origin.y));
        const distZ = stepZ > 0 ? (Math.floor(origin.z) + 1 - origin.z) : (origin.z - Math.floor(origin.z));

        let maxX = distX * deltaX;
        let maxY = distY * deltaY;
        let maxZ = distZ * deltaZ;
        
        let normal = new Vec3(0, 0, 0); 

        while (t <= maxDistance) {
            // Check if current block is solid
            if (this.getBlock(x, y, z) !== BlockType.AIR) {
                return {
                    position: new Vec3(x, y, z),
                    normal: normal
                };
            }

            // Move to next block
            if (maxX < maxY) {
                if (maxX < maxZ) {
                    x += stepX;
                    t = maxX;
                    maxX += deltaX;
                    normal = new Vec3(-stepX, 0, 0);
                } else {
                    z += stepZ;
                    t = maxZ;
                    maxZ += deltaZ;
                    normal = new Vec3(0, 0, -stepZ);
                }
            } else {
                if (maxY < maxZ) {
                    y += stepY;
                    t = maxY;
                    maxY += deltaY;
                    normal = new Vec3(0, -stepY, 0);
                } else {
                    z += stepZ;
                    t = maxZ;
                    maxZ += deltaZ;
                    normal = new Vec3(0, 0, -stepZ);
                }
            }
        }

        return null;
    }

    /**
     * Main game loop
     */
    private gameLoop(currentTime: number): void {
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;
        
        // Update camera
        this.camera.update(deltaTime);
        
        // Render
        this.renderer.render(this.camera, Array.from(this.chunks.values()));
        
        // Continue loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Pointer lock
        this.canvas.addEventListener('click', () => {
            this.canvas.requestPointerLock();
        });
        
        // Block interaction
        this.canvas.addEventListener('mousedown', (event) => {
            if (!this.isPointerLocked) return;

            const origin = this.camera.position;
            const direction = this.camera.getForward();
            const hit = this.raycast(origin, direction, 8); // 8 block reach

            if (hit) {
                if (event.button === 0) { // Left click: Remove block
                    this.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.AIR);
                } else if (event.button === 2) { // Right click: Place block
                    const placePos = Vec3.add(hit.position, hit.normal);
                    // Prevent placing block inside player
                    const playerPos = this.camera.position;
                    const distSq = (placePos.x + 0.5 - playerPos.x) ** 2 + 
                                   (placePos.y + 0.5 - playerPos.y) ** 2 + 
                                   (placePos.z + 0.5 - playerPos.z) ** 2;
                    
                    if (distSq > 1.0) { // Simple distance check
                        this.setBlock(placePos.x, placePos.y, placePos.z, this.selectedBlock);
                    }
                }
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
        });
        
        // Mouse movement
        document.addEventListener('mousemove', (event) => {
            if (this.isPointerLocked) {
                this.camera.onMouseMove(event.movementX, event.movementY);
            }
        });
        
        // Keyboard input
        window.addEventListener('keydown', (event) => {
            this.camera.onKeyDown(event.key);
        });
        
        window.addEventListener('keyup', (event) => {
            this.camera.onKeyUp(event.key);
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.renderer.resize(this.canvas.width, this.canvas.height);
            
            // Update camera projection
            this.camera.projectionMatrix = Mat4.perspective(
                Math.PI / 3,
                this.canvas.width / this.canvas.height,
                0.1,
                1000.0
            );
        });
    }

    /**
     * Resize canvas to match window size
     */
    private resizeCanvas(): void {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
    }

    /**
     * Show error message
     */
    private showError(message: string): void {
        const errorDiv = document.getElementById('error');
        const errorMessage = document.getElementById('error-message');
        
        if (errorDiv && errorMessage) {
            errorMessage.textContent = message;
            errorDiv.style.display = 'block';
        }
        
        console.error(message);
    }
}

// Start the game when DOM is loaded
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const game = new Game();
        await game.init();
    } catch (error) {
        console.error('Failed to start game:', error);
    }
});
