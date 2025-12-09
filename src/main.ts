import { Camera } from './camera.js';
import { Chunk } from './chunk.js';
import { Renderer } from './renderer.js';
import { Vec3, Mat4 } from './math.js';
import { BlockType, CHUNK_SIZE, CHUNK_HEIGHT } from './types.js';
import { Player, World } from './player.js';
import { TOON } from './toon.js';

/**
 * Main application class
 */
class Game implements World {
    private canvas: HTMLCanvasElement;
    private renderer: Renderer;
    private chunks: Map<string, Chunk> = new Map();
    private player: Player;
    
    private lastTime: number = 0;
    private isPointerLocked: boolean = false;
    private keys: Set<string> = new Set();
    
    // UI Elements
    private ui = {
        health: document.getElementById('health-container'),
        food: document.getElementById('food-container'),
        xp: document.getElementById('xp-bar-fill'),
        hotbar: document.getElementById('hotbar')
    };
    
    constructor() {
        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        
        // Set initial canvas size
        this.resizeCanvas();
        
        // Initialize renderer
        this.renderer = new Renderer(this.canvas);
        
        // Initialize player
        this.player = new Player(
            new Vec3(0, 50, 0), // Start high up to fall
            this.canvas.width / this.canvas.height
        );
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.initUI();
    }

    /**
     * Initialize UI elements
     */
    private initUI(): void {
        this.updateStatsUI();
        this.updateHotbarUI();
    }

    private updateStatsUI(): void {
        if (this.ui.health) {
            this.ui.health.innerHTML = '';
            const hearts = Math.ceil(this.player.health / 2);
            for (let i = 0; i < 10; i++) {
                const heart = document.createElement('div');
                heart.className = 'heart';
                if (i >= hearts) heart.style.opacity = '0.2';
                this.ui.health.appendChild(heart);
            }
        }
        
        if (this.ui.food) {
            this.ui.food.innerHTML = '';
            const food = Math.ceil(this.player.food / 2);
            for (let i = 0; i < 10; i++) {
                const drumstick = document.createElement('div');
                drumstick.className = 'food';
                if (i >= food) drumstick.style.opacity = '0.2';
                this.ui.food.appendChild(drumstick);
            }
        }
        
        if (this.ui.xp) {
            this.ui.xp.style.width = `${this.player.xp}%`;
        }
    }

    private updateHotbarUI(): void {
        if (!this.ui.hotbar) return;
        this.ui.hotbar.innerHTML = '';
        
        this.player.hotbar.forEach((block, index) => {
            const slot = document.createElement('div');
            slot.className = `slot ${index === this.player.selectedSlot ? 'active' : ''}`;
            slot.textContent = BlockType[block].substring(0, 3); // Abbreviate
            this.ui.hotbar?.appendChild(slot);
        });
    }

    /**
     * Initialize the game
     */
    async init(): Promise<void> {
        try {
            await this.renderer.init();
            
            // Try load last save
            if (TOON.exists('world')) {
                console.log('Found save data, use P to load.');
            }

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
        const renderDistance = 4;
        
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
     * Get block at world coordinates (World Interface)
     */
    getBlock(x: number, y: number, z: number): BlockType {
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
     * Save Game Data (TOON)
     */
    private saveGame(): void {
        const data = {
            player: {
                position: this.player.position,
                health: this.player.health,
                food: this.player.food,
                xp: this.player.xp,
                inventory: this.player.hotbar
            },
            // Note: Saving chunks is expensive, we'll only save modified ones in a real app
            // For now, we won't save chunks to keep it simple/fast
        };
        TOON.save('world', data);
        alert('Game Saved (TOON)');
    }

    /**
     * Load Game Data (TOON)
     */
    private loadGame(): void {
        const data = TOON.load<any>('world');
        if (data) {
            this.player.position = new Vec3(data.player.position.x, data.player.position.y, data.player.position.z);
            this.player.health = data.player.health;
            this.player.food = data.player.food;
            this.player.xp = data.player.xp;
            this.player.hotbar = data.player.inventory;
            this.updateStatsUI();
            this.updateHotbarUI();
            alert('Game Loaded (TOON)');
        } else {
            alert('No save found');
        }
    }

    /**
     * Main game loop
     */
    private gameLoop(currentTime: number): void {
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap dt
        this.lastTime = currentTime;
        
        // Update player (physics + camera)
        this.player.update(deltaTime, this, this.keys);
        
        // Render
        this.renderer.render(this.player.camera, Array.from(this.chunks.values()));
        
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

            const origin = this.player.camera.position;
            const direction = this.player.camera.getForward();
            const hit = this.raycast(origin, direction, 5); // 5 block reach

            if (hit) {
                if (event.button === 0) { // Left click: Remove block
                    this.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.AIR);
                } else if (event.button === 2) { // Right click: Place block
                    const placePos = Vec3.add(hit.position, hit.normal);
                    // Prevent placing block inside player collision box
                    const playerPos = this.player.position;
                    // Simple AABB check
                    const minX = playerPos.x - 0.3;
                    const maxX = playerPos.x + 0.3;
                    const minY = playerPos.y;
                    const maxY = playerPos.y + 1.8;
                    const minZ = playerPos.z - 0.3;
                    const maxZ = playerPos.z + 0.3;
                    
                    if (!(placePos.x + 1 > minX && placePos.x < maxX &&
                          placePos.y + 1 > minY && placePos.y < maxY &&
                          placePos.z + 1 > minZ && placePos.z < maxZ)) {
                        this.setBlock(placePos.x, placePos.y, placePos.z, this.player.getSelectedBlock());
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
                this.player.camera.onMouseMove(event.movementX, event.movementY);
            }
        });
        
        // Keyboard input
        window.addEventListener('keydown', (event) => {
            this.keys.add(event.key.toLowerCase());
            
            // UI updates on key press
            if (['1','2','3','4','5','6','7','8','9'].includes(event.key)) {
                setTimeout(() => this.updateHotbarUI(), 0);
            }
            
            // Save/Load
            if (event.key.toLowerCase() === 'o') this.saveGame();
            if (event.key.toLowerCase() === 'p') this.loadGame();
        });
        
        window.addEventListener('keyup', (event) => {
            this.keys.delete(event.key.toLowerCase());
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.renderer.resize(this.canvas.width, this.canvas.height);
            
            // Update camera projection
            this.player.camera.projectionMatrix = Mat4.perspective(
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