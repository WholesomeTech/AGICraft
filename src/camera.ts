import { Vec3, Mat4 } from './math.js';

/**
 * Camera class for first-person view with mouse look and WASD movement
 */
export class Camera {
    position: Vec3;
    yaw: number = -Math.PI / 2;  // Looking along -Z initially
    pitch: number = 0;
    
    // Movement
    moveSpeed: number = 5.0;
    mouseSensitivity: number = 0.002;
    
    // View matrices
    viewMatrix: Mat4;
    projectionMatrix: Mat4;
    
    // Movement state
    private keys: Set<string> = new Set();
    
    constructor(position: Vec3, fov: number, aspect: number, near: number, far: number) {
        this.position = position;
        this.viewMatrix = new Mat4();
        this.projectionMatrix = Mat4.perspective(fov, aspect, near, far);
        this.updateViewMatrix();
    }

    /**
     * Get camera forward direction
     */
    getForward(): Vec3 {
        return new Vec3(
            Math.cos(this.pitch) * Math.cos(this.yaw),
            Math.sin(this.pitch),
            Math.cos(this.pitch) * Math.sin(this.yaw)
        );
    }

    /**
     * Get camera right direction
     */
    getRight(): Vec3 {
        const forward = this.getForward();
        const up = new Vec3(0, 1, 0);
        return Vec3.normalize(Vec3.cross(forward, up));
    }

    /**
     * Update view matrix based on position and rotation
     */
    updateViewMatrix(): void {
        const forward = this.getForward();
        const target = Vec3.add(this.position, forward);
        const up = new Vec3(0, 1, 0);
        this.viewMatrix = Mat4.lookAt(this.position, target, up);
    }

    /**
     * Handle mouse movement for camera rotation
     */
    onMouseMove(deltaX: number, deltaY: number): void {
        this.yaw += deltaX * this.mouseSensitivity;
        this.pitch -= deltaY * this.mouseSensitivity;
        
        // Clamp pitch to prevent camera flip
        const maxPitch = Math.PI / 2 - 0.01;
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
        
        this.updateViewMatrix();
    }

    /**
     * Handle key down event
     */
    onKeyDown(key: string): void {
        this.keys.add(key.toLowerCase());
    }

    /**
     * Handle key up event
     */
    onKeyUp(key: string): void {
        this.keys.delete(key.toLowerCase());
    }

    /**
     * Update camera position based on input (call every frame)
     */
    update(deltaTime: number): void {
        const forward = this.getForward();
        const right = this.getRight();
        
        // Calculate movement direction
        let moveDir = new Vec3(0, 0, 0);
        
        if (this.keys.has('w')) {
            moveDir = Vec3.add(moveDir, forward);
        }
        if (this.keys.has('s')) {
            moveDir = Vec3.subtract(moveDir, forward);
        }
        if (this.keys.has('d')) {
            moveDir = Vec3.add(moveDir, right);
        }
        if (this.keys.has('a')) {
            moveDir = Vec3.subtract(moveDir, right);
        }
        if (this.keys.has('space')) {
            moveDir.y += 1;
        }
        if (this.keys.has('shift')) {
            moveDir.y -= 1;
        }
        
        // Normalize and apply movement
        const moveLength = Math.sqrt(moveDir.x * moveDir.x + moveDir.y * moveDir.y + moveDir.z * moveDir.z);
        if (moveLength > 0) {
            moveDir = Vec3.scale(moveDir, 1 / moveLength);
            this.position = Vec3.add(this.position, Vec3.scale(moveDir, this.moveSpeed * deltaTime));
            this.updateViewMatrix();
        }
    }

    /**
     * Get combined view-projection matrix
     */
    getViewProjectionMatrix(): Mat4 {
        return Mat4.multiply(this.projectionMatrix, this.viewMatrix);
    }
}
