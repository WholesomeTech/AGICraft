# AGICraft

A Minecraft-like voxel game engine built entirely with TypeScript and WebGPU. Features chunked terrain generation, greedy meshing optimization, first-person controls, and real-time rendering.

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Serve locally
npm run serve
```

Then open http://localhost:8080 in a WebGPU-enabled browser.

## Features

✨ **WebGPU Rendering** - Modern GPU-accelerated graphics  
🧱 **Chunked Voxel Terrain** - Efficient 16×16×16 block chunks  
⚡ **Greedy Meshing** - Advanced optimization reducing triangle count by 50-80%  
🎮 **First-Person Controls** - WASD movement + mouse look  
🌍 **Procedural Generation** - Dynamic terrain using heightmaps  
🎨 **Multiple Block Types** - Grass, dirt, stone with distinct colors

## Controls

- **WASD** - Move around
- **Space/Shift** - Move up/down  
- **Mouse** - Look around (click canvas first)

## Documentation

See [ARCHITECTURE.md](ARCHITECTURE.md) for:
- Detailed architecture overview
- File structure explanation
- Shader code documentation
- Buffer management details
- Greedy meshing algorithm explanation
- Performance considerations

## Browser Requirements

Requires a browser with WebGPU support:
- Chrome/Edge 113+ (enable via `chrome://flags`)
- Firefox Nightly (enable in `about:config`)
- Safari Technology Preview

## Project Structure

```
AGICraft/
├── src/
│   ├── main.ts       # Game loop and initialization
│   ├── renderer.ts   # WebGPU renderer with shaders
│   ├── camera.ts     # First-person camera
│   ├── chunk.ts      # Voxel chunks with greedy meshing
│   ├── math.ts       # Vector/matrix utilities
│   └── types.ts      # Block types and constants
├── dist/             # Compiled JavaScript
└── index.html        # Entry point
```

## Technology Stack

- **TypeScript** - Type-safe development
- **WebGPU** - Modern graphics API
- **WGSL** - WebGPU Shading Language
- **No frameworks** - Clean, minimal dependencies

## License

MIT - See LICENSE file

