/**
 * TOON (Token-Oriented Object Notation) - Persistence Layer
 * 
 * Implements world and player data saving/loading using a JSON-compatible format.
 * Includes versioning and validation.
 */

export interface ToonData {
    version: number;
    timestamp: number;
    data: any;
}

export class TOON {
    private static readonly STORAGE_PREFIX = 'agicraft_toon_';
    private static readonly VERSION = 1;

    /**
     * Serialize object to TOON string
     */
    static stringify(data: any): string {
        const toonData: ToonData = {
            version: TOON.VERSION,
            timestamp: Date.now(),
            data: data
        };
        return JSON.stringify(toonData);
    }

    /**
     * Parse TOON string to object
     */
    static parse<T>(toonString: string): T | null {
        try {
            const toonData = JSON.parse(toonString) as ToonData;
            if (toonData.version > TOON.VERSION) {
                console.warn(`Warning: Loading data from newer TOON version ${toonData.version}`);
            }
            return toonData.data as T;
        } catch (e) {
            console.error('Failed to parse TOON data:', e);
            return null;
        }
    }

    /**
     * Save data to local storage
     */
    static save(key: string, data: any): void {
        const toonString = TOON.stringify(data);
        localStorage.setItem(TOON.STORAGE_PREFIX + key, toonString);
        console.log(`Saved ${key} to TOON storage`);
    }

    /**
     * Load data from local storage
     */
    static load<T>(key: string): T | null {
        const item = localStorage.getItem(TOON.STORAGE_PREFIX + key);
        if (!item) return null;
        return TOON.parse<T>(item);
    }

    /**
     * Check if key exists
     */
    static exists(key: string): boolean {
        return localStorage.getItem(TOON.STORAGE_PREFIX + key) !== null;
    }

    /**
     * Delete data from local storage
     */
    static delete(key: string): void {
        localStorage.removeItem(TOON.STORAGE_PREFIX + key);
    }

    /**
     * Get list of all save keys
     */
    static getSaves(): string[] {
        const saves: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(TOON.STORAGE_PREFIX)) {
                saves.push(key.substring(TOON.STORAGE_PREFIX.length));
            }
        }
        return saves;
    }
}
