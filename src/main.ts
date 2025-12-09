import { Chunk } from './chunk.js';
import { Renderer } from './renderer.js';
import { Vec3, Mat4 } from './math.js';
import { BlockType, CHUNK_SIZE, CHUNK_HEIGHT } from './types.js';
import { Player, World } from './player.js';
import { TOON } from './toon.js';
import { CraftingSystem } from './recipes.js';

enum GameState {
    MENU,
    PLAYING,
    PAUSED,
    INVENTORY
}

/**
 * Main application class
 */
class Game implements World {
    private canvas: HTMLCanvasElement;
    private renderer: Renderer;
    private chunks: Map<string, Chunk> = new Map();
    private player: Player;
    
    // Game State
    private state: GameState = GameState.MENU;
    private currentWorldId: string = 'world_default';
    private lastTime: number = 0;
    private isPointerLocked: boolean = false;
    private keys: Set<string> = new Set();
    
    // Settings
    private settings = {
        renderDistance: 4
    };

    // Persistence for infinite world (Coordinate -> BlockType)
    private modifiedBlocks: Map<string, BlockType> = new Map();

    // Crafting State
    private craftingGrid: (BlockType | null)[] = [null, null, null, null];
    private craftingOutput: BlockType | null = null;
    private heldItem: BlockType | null = null; // Mouse cursor item

    // UI Elements
    private ui = {
        screens: {
            main: document.getElementById('main-menu'),
            pause: document.getElementById('pause-menu'),
            settings: document.getElementById('settings-menu'),
            inventory: document.getElementById('inventory-menu'),
            hud: document.getElementById('ui-layer')
        },
        hud: {
            health: document.getElementById('health-container'),
            food: document.getElementById('food-container'),
            xp: document.getElementById('xp-bar-fill'),
            hotbar: document.getElementById('hotbar')
        },
        inventory: {
            main: document.getElementById('main-inventory-grid'),
            hotbar: document.getElementById('hotbar-inventory-grid'),
            crafting: document.getElementById('crafting-grid'),
            output: document.getElementById('crafting-output')
        },
        inputs: {
            renderDistance: document.getElementById('render-distance') as HTMLInputElement,
            renderDistanceVal: document.getElementById('val-render-distance'),
            newWorldName: document.getElementById('new-world-name') as HTMLInputElement,
            worldList: document.getElementById('world-list')
        }
    };
    
    constructor() {
        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!this.canvas) throw new Error('Canvas element not found');
        
        this.resizeCanvas();
        this.renderer = new Renderer(this.canvas);
        
        // Initialize player high up
        this.player = new Player(new Vec3(0, 50, 0), this.canvas.width / this.canvas.height);
        
        this.setupEventListeners();
        this.setupUIListeners();
        this.refreshWorldList();
    }

    async init(): Promise<void> {
        try {
            await this.renderer.init();
            // Start loop (will handle menu logic)
            this.lastTime = performance.now();
            requestAnimationFrame((time) => this.gameLoop(time));
            console.log('Game initialized');
        } catch (error) {
            console.error(error);
        }
    }

    // --- State Management ---

    private setGameState(newState: GameState) {
        this.state = newState;
        
        // Hide all screens first
        Object.values(this.ui.screens).forEach(el => el?.classList.add('hidden'));

        if (newState === GameState.MENU) {
            this.ui.screens.main?.classList.remove('hidden');
            this.exitPointerLock();
        } else if (newState === GameState.PLAYING) {
            this.ui.screens.hud?.classList.remove('hidden');
            this.requestPointerLock();
        } else if (newState === GameState.PAUSED) {
            this.ui.screens.pause?.classList.remove('hidden');
            this.ui.screens.hud?.classList.remove('hidden'); // Keep HUD visible underneath
            this.exitPointerLock();
        } else if (newState === GameState.INVENTORY) {
            this.ui.screens.inventory?.classList.remove('hidden');
            this.updateInventoryUI();
            this.exitPointerLock();
        }
    }

    private openSettings(fromMenu: boolean) {
        this.ui.screens.main?.classList.add('hidden');
        this.ui.screens.pause?.classList.add('hidden');
        this.ui.screens.settings?.classList.remove('hidden');
        
        // Store return path
        (this.ui.screens.settings as any)._returnState = fromMenu ? GameState.MENU : GameState.PAUSED;
    }

    private closeSettings() {
        const returnState = (this.ui.screens.settings as any)._returnState || GameState.MENU;
        this.setGameState(returnState);
    }

    // --- Infinite World Generation ---

    private updateChunks() {
        const px = Math.floor(this.player.position.x / CHUNK_SIZE);
        const pz = Math.floor(this.player.position.z / CHUNK_SIZE);
        const dist = this.settings.renderDistance;

        const neededChunks = new Set<string>();

        // Identify needed chunks
        for (let x = -dist; x <= dist; x++) {
            for (let z = -dist; z <= dist; z++) {
                // Circular render distance check
                if (x*x + z*z > dist*dist) continue;
                neededChunks.add(`${px + x},${pz + z}`);
            }
        }

        // Unload far chunks
        for (const key of this.chunks.keys()) {
            if (!neededChunks.has(key)) {
                this.chunks.delete(key);
                // Renderer cleanup would happen here if we tracked buffers per key strictly
                // For now, simpler map usage
            }
        }

        // Load new chunks
        let chunksModified = false;
        for (const key of neededChunks) {
            if (!this.chunks.has(key)) {
                const [cx, cz] = key.split(',').map(Number);
                const chunk = new Chunk(cx, cz);
                
                // Apply modifications (infinite world persistence)
                this.applyModificationsToChunk(chunk);
                
                chunk.buildMesh();
                this.chunks.set(key, chunk);
                this.renderer.updateChunk(chunk); // Upload to GPU
                chunksModified = true;
            }
        }
    }

    private applyModificationsToChunk(chunk: Chunk) {
        // This is O(N) where N is total modified blocks. 
        // Optimized: Store modified blocks by chunk key in a separate mapMap.
        // For prototype, simple iteration is okay or coordinate check.
        const startX = chunk.x * CHUNK_SIZE;
        const startZ = chunk.z * CHUNK_SIZE;
        
        // Iterate only modified blocks (better optimization required for massive worlds)
        // For now, we will just check if any modified block belongs to this chunk
        this.modifiedBlocks.forEach((type, key) => {
            const [x, y, z] = key.split(',').map(Number);
            if (x >= startX && x < startX + CHUNK_SIZE &&
                z >= startZ && z < startZ + CHUNK_SIZE) {
                // Convert to local
                const lx = x - startX;
                const lz = z - startZ;
                chunk.setBlock(lx, y, lz, type);
            }
        });
        
        // Since we modified via setBlock (which sets dirty), we need to ensure mesh is built
    }

    // --- Persistence (TOON) ---

    private saveGame() {
        const data = {
            player: {
                position: this.player.position,
                stats: {
                    health: this.player.health,
                    food: this.player.food,
                    xp: this.player.xp
                },
                inventory: this.player.inventory,
                hotbar: this.player.hotbar
            },
            modifiedBlocks: Array.from(this.modifiedBlocks.entries()), // Serialize Map
            settings: this.settings
        };
        TOON.save(this.currentWorldId, data);
        console.log('Game Saved');
    }

    private loadGame(worldId: string) {
        const data = TOON.load<any>(worldId);
        if (data) {
            this.currentWorldId = worldId;
            // Player
            this.player.position = new Vec3(data.player.position.x, data.player.position.y, data.player.position.z);
            this.player.health = data.player.stats.health;
            this.player.food = data.player.stats.food;
            this.player.xp = data.player.stats.xp;
            this.player.inventory = data.player.inventory || new Array(27).fill(BlockType.AIR);
            this.player.hotbar = data.player.hotbar;
            
            // World
            this.modifiedBlocks = new Map(data.modifiedBlocks);
            this.chunks.clear(); // Force regeneration with mods
            
            // Settings
            if (data.settings) {
                this.settings = data.settings;
                this.updateSettingsUI();
            }

            this.updateHUD();
            this.setGameState(GameState.PLAYING);
        } else {
            console.error('Save not found');
        }
    }

    private createWorld(name: string) {
        this.currentWorldId = 'world_' + name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        this.chunks.clear();
        this.modifiedBlocks.clear();
        this.player = new Player(new Vec3(0, 50, 0), this.canvas.width / this.canvas.height);
        this.settings.renderDistance = 4;
        
        this.updateHUD();
        this.setGameState(GameState.PLAYING);
    }

    // --- Core Loops ---

    private gameLoop(currentTime: number): void {
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        if (this.state === GameState.PLAYING) {
            // Update Logic
            this.player.update(deltaTime, this, this.keys);
            this.updateChunks();
        }

        // Render (always render if possible, even if paused)
        // If paused, maybe apply a darkening filter or just stop updates
        this.renderer.render(this.player.camera, Array.from(this.chunks.values()));

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    // --- World Interface ---

    getBlock(x: number, y: number, z: number): BlockType {
        if (y < 0 || y >= CHUNK_HEIGHT) return BlockType.AIR;
        
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks.get(`${cx},${cz}`);
        
        if (!chunk) return BlockType.AIR; // Treat unloaded chunks as air (or void)
        
        const lx = (x % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = (z % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        
        return chunk.getBlock(lx, y, lz);
    }

    setBlock(x: number, y: number, z: number, type: BlockType): void {
        if (y < 0 || y >= CHUNK_HEIGHT) return;
        
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks.get(`${cx},${cz}`);
        
        // Track modification for infinite world persistence
        this.modifiedBlocks.set(`${x},${y},${z}`, type);
        
        if (chunk) {
            const lx = (x % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
            const lz = (z % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
            
            chunk.setBlock(lx, y, lz, type);
            chunk.buildMesh();
            this.renderer.updateChunk(chunk);
        }
    }

    // --- UI & Input ---

    private refreshWorldList() {
        const list = this.ui.inputs.worldList;
        if (!list) return;
        list.innerHTML = '';
        
        const saves = TOON.getSaves();
        if (saves.length === 0) {
            list.innerHTML = '<p>No saved worlds</p>';
            return;
        }

        saves.forEach(key => {
            const btn = document.createElement('button');
            btn.textContent = `Load: ${key.replace('world_', '')}`;
            btn.onclick = () => this.loadGame(key);
            list.appendChild(btn);
        });
    }

    private updateSettingsUI() {
        if (this.ui.inputs.renderDistance) {
            this.ui.inputs.renderDistance.value = this.settings.renderDistance.toString();
        }
        if (this.ui.inputs.renderDistanceVal) {
            this.ui.inputs.renderDistanceVal.textContent = this.settings.renderDistance.toString();
        }
    }

    private updateHUD() {
        this.updateStatsUI();
        this.updateHotbarUI();
    }

    private updateStatsUI() {
        if (this.ui.hud.health) {
            this.ui.hud.health.innerHTML = '';
            const hearts = Math.ceil(this.player.health / 2);
            for (let i = 0; i < 10; i++) {
                const heart = document.createElement('div');
                heart.className = 'heart';
                if (i >= hearts) heart.style.opacity = '0.2';
                this.ui.hud.health.appendChild(heart);
            }
        }
        if (this.ui.hud.food) {
            this.ui.hud.food.innerHTML = '';
            const food = Math.ceil(this.player.food / 2);
            for (let i = 0; i < 10; i++) {
                const item = document.createElement('div');
                item.className = 'food';
                if (i >= food) item.style.opacity = '0.2';
                this.ui.hud.food.appendChild(item);
            }
        }
        if (this.ui.hud.xp) {
            this.ui.hud.xp.style.width = `${this.player.xp}%`;
        }
    }

    private updateHotbarUI() {
        if (!this.ui.hud.hotbar) return;
        this.ui.hud.hotbar.innerHTML = '';
        this.player.hotbar.forEach((block, index) => {
            const slot = document.createElement('div');
            slot.className = `slot ${index === this.player.selectedSlot ? 'active' : ''}`;
            slot.textContent = block !== BlockType.AIR ? BlockType[block].substring(0, 3) : '';
            this.ui.hud.hotbar?.appendChild(slot);
        });
    }

    // --- Inventory UI & Logic ---

    private updateInventoryUI() {
        const createSlot = (item: BlockType, onClick: () => void) => {
            const div = document.createElement('div');
            div.className = 'slot';
            if (item !== BlockType.AIR) {
                div.textContent = BlockType[item].substring(0, 3);
            }
            div.onclick = onClick;
            return div;
        };

        // Main Inventory (27 slots)
        if (this.ui.inventory.main) {
            this.ui.inventory.main.innerHTML = '';
            this.player.inventory.forEach((item, i) => {
                this.ui.inventory.main?.appendChild(createSlot(item, () => {
                    // Simple swap with held item (not implemented fully for drag/drop, just click to swap)
                    // For prototype: click to delete/debug or just view
                }));
            });
        }

        // Hotbar in Inventory
        if (this.ui.inventory.hotbar) {
            this.ui.inventory.hotbar.innerHTML = '';
            this.player.hotbar.forEach((item, i) => {
                this.ui.inventory.hotbar?.appendChild(createSlot(item, () => {}));
            });
        }

        // Crafting Grid
        if (this.ui.inventory.crafting) {
            const slots = this.ui.inventory.crafting.children;
            for (let i = 0; i < 4; i++) {
                const slot = slots[i] as HTMLElement;
                const item = this.craftingGrid[i];
                slot.textContent = item ? BlockType[item].substring(0, 3) : '';
                slot.onclick = () => {
                    // Cycle through some items for testing crafting if empty, or clear
                    // In a real game, this would interact with "held item"
                    if (this.craftingGrid[i] === null) {
                         this.craftingGrid[i] = BlockType.WOOD; // Debug: Click to add wood
                    } else {
                        this.craftingGrid[i] = null;
                    }
                    this.checkCrafting();
                    this.updateInventoryUI(); // Redraw
                };
            }
        }
        
        // Crafting Output
        if (this.ui.inventory.output) {
             const out = this.ui.inventory.output;
             out.textContent = this.craftingOutput ? BlockType[this.craftingOutput].substring(0, 3) : '';
             out.onclick = () => {
                 if (this.craftingOutput) {
                     // Craft!
                     // Add to inventory (find first empty slot)
                     const emptyIdx = this.player.hotbar.indexOf(BlockType.AIR);
                     if (emptyIdx !== -1) {
                         this.player.hotbar[emptyIdx] = this.craftingOutput;
                     } else {
                          const invIdx = this.player.inventory.indexOf(BlockType.AIR);
                          if (invIdx !== -1) this.player.inventory[invIdx] = this.craftingOutput;
                     }
                     
                     // Consume inputs
                     // (For now, simple consumption)
                     this.craftingGrid = [null, null, null, null];
                     this.craftingOutput = null;
                     this.updateInventoryUI();
                     this.updateHUD(); // Update hotbar
                 }
             };
        }
    }

    private checkCrafting() {
        const recipe = CraftingSystem.checkRecipe(this.craftingGrid);
        if (recipe) {
            this.craftingOutput = recipe.output;
        } else {
            this.craftingOutput = null;
        }
    }

    private setupUIListeners() {
        // Main Menu
        document.getElementById('btn-create-world')?.addEventListener('click', () => {
            const name = this.ui.inputs.newWorldName?.value || 'NewWorld';
            this.createWorld(name);
        });
        document.getElementById('btn-settings-main')?.addEventListener('click', () => this.openSettings(true));

        // Pause Menu
        document.getElementById('btn-resume')?.addEventListener('click', () => this.setGameState(GameState.PLAYING));
        document.getElementById('btn-save')?.addEventListener('click', () => this.saveGame());
        document.getElementById('btn-settings-pause')?.addEventListener('click', () => this.openSettings(false));
        document.getElementById('btn-quit')?.addEventListener('click', () => {
            this.saveGame();
            this.setGameState(GameState.MENU);
            this.refreshWorldList();
        });

        // Settings
        document.getElementById('btn-back-settings')?.addEventListener('click', () => this.closeSettings());
        this.ui.inputs.renderDistance?.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value);
            this.settings.renderDistance = val;
            if (this.ui.inputs.renderDistanceVal) this.ui.inputs.renderDistanceVal.textContent = val.toString();
        });
    }

    private setupEventListeners() {
        // Pointer Lock & Click
        this.canvas.addEventListener('click', () => {
            if (this.state === GameState.PLAYING) {
                this.requestPointerLock();
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.state !== GameState.PLAYING || !this.isPointerLocked) return;
            this.handleBlockInteraction(e.button);
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
            if (!this.isPointerLocked && this.state === GameState.PLAYING) {
                this.setGameState(GameState.PAUSED);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.state === GameState.PLAYING && this.isPointerLocked) {
                this.player.camera.onMouseMove(e.movementX, e.movementY);
            }
        });

        // Keys
        window.addEventListener('keydown', (e) => {
            if (this.state === GameState.PLAYING) {
                if (e.key === 'Escape') {
                    // Handled by pointerlockchange
                } else if (e.key.toLowerCase() === 'e') {
                     this.setGameState(GameState.INVENTORY);
                } else if (['1','2','3','4','5','6','7','8','9'].includes(e.key)) {
                     this.keys.add(e.key); // Pass to player
                     setTimeout(() => this.updateHotbarUI(), 0);
                } else {
                    this.keys.add(e.key.toLowerCase());
                }
            } else if (this.state === GameState.PAUSED) {
                if (e.key === 'Escape') {
                    this.setGameState(GameState.PLAYING);
                }
            } else if (this.state === GameState.INVENTORY) {
                if (e.key === 'Escape' || e.key.toLowerCase() === 'e') {
                    this.setGameState(GameState.PLAYING);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase());
            this.keys.delete(e.key); // numeric keys
        });
        
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.renderer.resize(this.canvas.width, this.canvas.height);
            this.player.camera.projectionMatrix = Mat4.perspective(
                Math.PI / 3,
                this.canvas.width / this.canvas.height,
                0.1,
                1000.0
            );
        });
    }

    private requestPointerLock() {
        this.canvas.requestPointerLock();
    }
    
    private exitPointerLock() {
        document.exitPointerLock();
    }

    private handleBlockInteraction(button: number) {
        const origin = this.player.camera.position;
        const direction = this.player.camera.getForward();
        const hit = this.raycast(origin, direction, 5);

        if (hit) {
            if (button === 0) { // Left: Break
                // Add item to inventory?
                // For prototype: just delete
                this.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.AIR);
            } else if (button === 2) { // Right: Place
                const placePos = Vec3.add(hit.position, hit.normal);
                // Simple collision check
                const playerPos = this.player.position;
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
    }

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

    private resizeCanvas(): void {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
    }
}

// Boot
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const game = new Game();
        await game.init();
    } catch (error) {
        console.error('Failed to start game:', error);
    }
});
