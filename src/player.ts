import { Vec3, Mat4 } from './math.js';
import { Camera } from './camera.js';
import { BlockType } from './types.js';

/**
 * Interface for world collision queries
 */
export interface World {
    getBlock(x: number, y: number, z: number): BlockType;
}

/**
 * Player class handling physics, movement, and stats
 */
export class Player {
    // Physics
    position: Vec3;
    velocity: Vec3 = new Vec3(0, 0, 0);
    onGround: boolean = false;
    
    // Camera
    camera: Camera;
    
    // Stats
    health: number = 20;
    maxHealth: number = 20;
    food: number = 20;
    maxFood: number = 20;
    xp: number = 0;
    level: number = 0;
    
    // Inventory
    hotbar: BlockType[] = [
        BlockType.STONE, 
        BlockType.DIRT, 
        BlockType.GRASS, 
        BlockType.STONE, // Placeholder for other blocks
        BlockType.DIRT, 
        BlockType.GRASS,
        BlockType.STONE,
        BlockType.DIRT,
        BlockType.GRASS
    ];
    selectedSlot: number = 0;
    
    // Constants
    private readonly GRAVITY = 25.0; // gravity
    private readonly JUMP_FORCE = 8.5; // jump height approx 1.2 blocks
    private readonly MOVE_SPEED = 4.3; // roughly 4.3 m/s walking speed
    private readonly AIR_CONTROL = 0.3;
    private readonly FRICTION = 10.0;
    private readonly AIR_RESISTANCE = 0.5;
    
    // Dimensions
    private readonly WIDTH = 0.6;
    private readonly HEIGHT = 1.8;
    private readonly EYE_HEIGHT = 1.62;

    constructor(position: Vec3, canvasAspectRatio: number) {
        this.position = position;
        this.camera = new Camera(
            new Vec3(position.x, position.y + this.EYE_HEIGHT, position.z),
            Math.PI / 3, // 60 deg
            canvasAspectRatio,
            0.1,
            1000.0
        );
    }

    /**
     * Get selected block type
     */
    getSelectedBlock(): BlockType {
        return this.hotbar[this.selectedSlot];
    }

    /**
     * Handle input and physics update
     */
    update(dt: number, world: World, keys: Set<string>): void {
        this.handleInput(dt, keys);
        this.applyPhysics(dt, world);
        this.updateCamera();
    }

    private handleInput(dt: number, keys: Set<string>): void {
        // Movement input
        let inputDir = new Vec3(0, 0, 0);
        const forward = this.camera.getForward();
        const right = this.camera.getRight();
        
        // Flatten vectors to horizontal plane
        forward.y = 0;
        right.y = 0;
        const fwdNorm = Vec3.normalize(forward);
        const rightNorm = Vec3.normalize(right);

        if (keys.has('w')) inputDir = Vec3.add(inputDir, fwdNorm);
        if (keys.has('s')) inputDir = Vec3.subtract(inputDir, fwdNorm);
        if (keys.has('d')) inputDir = Vec3.add(inputDir, rightNorm);
        if (keys.has('a')) inputDir = Vec3.subtract(inputDir, rightNorm);

        // Normalize input
        if (inputDir.x !== 0 || inputDir.z !== 0) {
            inputDir = Vec3.normalize(inputDir);
        }

        // Apply movement force
        const speed = this.MOVE_SPEED;
        const accel = this.onGround ? speed * 10 : speed * 2; // Less control in air

        // Apply horizontal acceleration
        this.velocity.x += inputDir.x * accel * dt;
        this.velocity.z += inputDir.z * accel * dt;

        // Apply friction
        const friction = this.onGround ? this.FRICTION : this.AIR_RESISTANCE;
        const frictionFactor = Math.max(0, 1 - friction * dt);
        this.velocity.x *= frictionFactor;
        this.velocity.z *= frictionFactor;

        // Jump
        if (keys.has(' ') && this.onGround) {
            this.velocity.y = this.JUMP_FORCE;
            this.onGround = false;
        }
        
        // Hotbar selection
        for (let i = 1; i <= 9; i++) {
            if (keys.has(i.toString())) {
                this.selectedSlot = i - 1;
            }
        }
    }

    private applyPhysics(dt: number, world: World): void {
        // Gravity
        this.velocity.y -= this.GRAVITY * dt;

        // Apply velocity to position with collision detection (swept AABB roughly)
        // We do axis-separate collision to allow sliding
        
        // X Axis
        this.position.x += this.velocity.x * dt;
        if (this.checkCollision(world)) {
            this.position.x -= this.velocity.x * dt;
            this.velocity.x = 0;
        }

        // Z Axis
        this.position.z += this.velocity.z * dt;
        if (this.checkCollision(world)) {
            this.position.z -= this.velocity.z * dt;
            this.velocity.z = 0;
        }

        // Y Axis
        this.position.y += this.velocity.y * dt;
        this.onGround = false;
        if (this.checkCollision(world)) {
            const wasFalling = this.velocity.y < 0;
            this.position.y -= this.velocity.y * dt;
            this.velocity.y = 0;
            
            if (wasFalling) {
                this.onGround = true;
            }
        }
    }

    private checkCollision(world: World): boolean {
        // Player AABB
        const minX = Math.floor(this.position.x - this.WIDTH / 2);
        const maxX = Math.floor(this.position.x + this.WIDTH / 2);
        const minY = Math.floor(this.position.y);
        const maxY = Math.floor(this.position.y + this.HEIGHT);
        const minZ = Math.floor(this.position.z - this.WIDTH / 2);
        const maxZ = Math.floor(this.position.z + this.WIDTH / 2);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const block = world.getBlock(x, y, z);
                    if (block !== BlockType.AIR) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private updateCamera(): void {
        this.camera.position = new Vec3(
            this.position.x,
            this.position.y + this.EYE_HEIGHT,
            this.position.z
        );
        this.camera.updateViewMatrix();
    }
}
