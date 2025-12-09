import { BlockType } from './types.js';

export interface Recipe {
    input: BlockType[]; // Up to 4 items (2x2 grid)
    output: BlockType;
    outputCount: number;
}

// 2x2 Crafting Recipes
// Grid indices: 0 1
//               2 3
export const RECIPES: Recipe[] = [
    {
        input: [BlockType.WOOD],
        output: BlockType.PLANKS,
        outputCount: 4
    },
    {
        input: [BlockType.PLANKS, BlockType.PLANKS, BlockType.PLANKS, BlockType.PLANKS],
        output: BlockType.CRAFTING_TABLE,
        outputCount: 1
    },
    // Add more recipes here
    {
        input: [BlockType.STONE, BlockType.STONE, BlockType.STONE, BlockType.STONE], // Simple "stone brick" or furnace placeholder
        output: BlockType.FURNACE,
        outputCount: 1
    }
];

export class CraftingSystem {
    static checkRecipe(grid: (BlockType | null)[]): Recipe | null {
        // Grid should be size 4 for 2x2
        // We need to match the input pattern.
        // Simple matching: exact match for now.
        // A robust system would handle shaped/shapeless logic more generally.
        
        for (const recipe of RECIPES) {
            if (this.matches(grid, recipe.input)) {
                return recipe;
            }
        }
        return null;
    }

    private static matches(grid: (BlockType | null)[], input: BlockType[]): boolean {
        // Simple shapeless check for 1-item recipes (like wood -> planks)
        if (input.length === 1) {
            let count = 0;
            let match = false;
            for (const item of grid) {
                if (item !== null) {
                    count++;
                    if (item === input[0]) match = true;
                }
            }
            return count === 1 && match;
        }

        // Exact match for 4-item recipes
        if (input.length === 4) {
            for (let i = 0; i < 4; i++) {
                if (grid[i] !== input[i]) return false;
            }
            return true;
        }

        return false;
    }
}
