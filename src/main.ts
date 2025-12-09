import { Camera } from './camera.js';
import { Chunk } from './chunk.js';
import { Renderer } from './renderer.js';
import { Vec3, Mat4 } from './math.js';

/**
 * Main application class
 */
class Game {
    private canvas: HTMLCanvasElement;
    private renderer: Renderer;
    private camera: Camera;
    private chunks: Chunk[] = [];
    
    private lastTime: number = 0;
    private isPointerLocked: boolean = false;
    
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
                this.chunks.push(chunk);
            }
        }
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
        this.renderer.render(this.camera, this.chunks);
        
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
