# AGICraft - WebGPU Voxel Terrain Engine

A Minecraft-like voxel game engine built with TypeScript and WebGPU, featuring chunked terrain, greedy meshing optimization, and first-person controls.

## Features

- **WebGPU Rendering**: Modern GPU-accelerated graphics using WebGPU API
- **Chunked Terrain**: Efficient 16x16x16 voxel chunks for scalable world generation
- **Greedy Meshing**: Advanced optimization algorithm that reduces triangle count by merging adjacent faces
- **Block Types**: Multiple block types (Air, Grass, Dirt, Stone) with distinct colors
- **First-Person Camera**: WASD movement and mouse look controls
- **Real-time Rendering**: Smooth 60 FPS rendering with depth testing and backface culling
- **Procedural Generation**: Simple terrain generation using sine wave heightmaps

## Prerequisites

- A modern web browser with WebGPU support:
  - Chrome/Edge 113+ with WebGPU enabled
  - Firefox Nightly with WebGPU enabled
  - Safari Technology Preview with WebGPU enabled
- Node.js and npm for building

## Build Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/WholesomeTech/AGICraft.git
   cd AGICraft
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the TypeScript code:**
   ```bash
   npm run build
   ```

4. **Serve the application:**
   ```bash
   npm run serve
   ```
   Then open your browser to `http://localhost:8080`

   Alternatively, use any static file server or open `index.html` directly if your browser allows.

## Controls

- **W/A/S/D** - Move forward/left/backward/right
- **Space** - Move up
- **Shift** - Move down
- **Mouse** - Look around (click canvas to capture mouse)

## Project Structure

```
AGICraft/
├── src/                    # TypeScript source files
│   ├── main.ts            # Application entry point and game loop
│   ├── renderer.ts        # WebGPU renderer with shader management
│   ├── camera.ts          # First-person camera with controls
│   ├── chunk.ts           # Voxel chunk with greedy meshing
│   ├── math.ts            # Vector and matrix math utilities
│   └── types.ts           # Block types and constants
├── dist/                  # Compiled JavaScript (generated)
├── index.html            # HTML entry point with canvas
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## Architecture Overview

### File Descriptions

#### `src/main.ts`
Main application entry point that:
- Initializes the game engine
- Sets up event listeners for input
- Manages the game loop
- Handles window resize events
- Coordinates between camera, chunks, and renderer

#### `src/renderer.ts`
WebGPU renderer responsible for:
- Initializing WebGPU device and context
- Creating and managing the render pipeline
- Compiling WGSL shaders
- Managing GPU buffers for chunk geometry
- Rendering frames with proper depth testing

#### `src/camera.ts`
First-person camera implementation:
- Manages position and rotation (yaw/pitch)
- Handles WASD keyboard input for movement
- Processes mouse movement for looking around
- Generates view and projection matrices
- Prevents camera gimbal lock

#### `src/chunk.ts`
Voxel chunk system with:
- 16x16x16 block storage using typed arrays
- Procedural terrain generation
- **Greedy meshing algorithm** for optimization
- Face culling (hidden faces not rendered)
- Vertex data generation with colors

#### `src/math.ts`
Math utilities providing:
- `Vec3` class for 3D vector operations
- `Mat4` class for 4x4 matrix transformations
- Perspective projection matrix generation
- Look-at matrix for camera view
- Matrix multiplication

#### `src/types.ts`
Shared type definitions and constants:
- `BlockType` enum (Air, Grass, Dirt, Stone)
- `Face` enum for cube faces
- Block color palette
- Cube vertex data for each face
- Face normals for lighting

## Shaders

The engine uses WGSL (WebGPU Shading Language) shaders defined in `src/renderer.ts`:

### Vertex Shader
```wgsl
@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = uniforms.viewProjection * vec4<f32>(input.position, 1.0);
    output.color = input.color;
    return output;
}
```
- Transforms vertex positions using view-projection matrix
- Passes through vertex colors

### Fragment Shader
```wgsl
@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}
```
- Outputs the interpolated vertex color

## Buffer Management

### Vertex Buffers
Each chunk has a GPU buffer containing:
- **Position** (3 floats): x, y, z coordinates
- **Color** (3 floats): r, g, b values
- **Stride**: 24 bytes (6 floats × 4 bytes)

Vertex data is uploaded once when chunks are generated or modified.

### Uniform Buffers
A single uniform buffer stores:
- **View-Projection Matrix** (4×4 floats = 64 bytes)
- Updated every frame with camera transforms

## Greedy Meshing Algorithm

The greedy meshing algorithm is a key optimization that reduces the number of triangles rendered:

1. **For each face direction** (front, back, top, bottom, left, right):
   - Scan through slices perpendicular to the face normal
   
2. **Build a mask** for each slice:
   - Mark which blocks have exposed faces (adjacent to air)
   
3. **Merge adjacent quads**:
   - Find rectangular regions of the same block type
   - Expand horizontally as far as possible
   - Then expand vertically
   
4. **Generate merged geometry**:
   - Create single large quads instead of many small ones
   - Clear processed areas from the mask
   
This reduces triangle count by 50-80% compared to naive rendering, significantly improving performance.

## Chunk Updates

Chunks are marked dirty when blocks change:
1. `chunk.setBlock()` sets `isDirty = true`
2. On next frame, renderer detects dirty flag
3. `chunk.buildMesh()` regenerates geometry using greedy meshing
4. Renderer uploads new vertex data to GPU
5. Chunk is marked clean

This allows real-time terrain modification while maintaining performance.

## Performance Considerations

- **Greedy Meshing**: Dramatically reduces vertex count
- **Face Culling**: Interior faces are never generated
- **Backface Culling**: GPU automatically culls back-facing triangles
- **Depth Testing**: Proper z-buffering for correct rendering order
- **Typed Arrays**: Efficient memory layout for GPU transfers
- **Chunk System**: Only visible chunks are rendered
- **Dirty Flagging**: Meshes only rebuilt when necessary

## Browser Compatibility

WebGPU is still experimental. To enable it:

- **Chrome/Edge**: Enable `chrome://flags/#enable-unsafe-webgpu`
- **Firefox**: Enable `dom.webgpu.enabled` in `about:config`
- **Safari**: Use Safari Technology Preview

## Extending the Engine

### Adding New Block Types

1. Add to `BlockType` enum in `src/types.ts`
2. Add color to `BLOCK_COLORS` in `src/types.ts`
3. Update terrain generation in `chunk.generate()`

### Adding Textures

Modify the shader and vertex format to include UV coordinates:
1. Add texture coordinates to vertex data
2. Update vertex buffer stride
3. Modify shader to sample from texture atlas
4. Create texture and sampler in renderer

### Adding More Chunks

Increase `renderDistance` in `main.ts` `generateChunks()` method to render more chunks (note: this increases memory usage).

## Known Limitations

- Single chunk type (no infinite worlds yet)
- No block breaking/placing interaction
- No collision detection
- Simple lighting model (face-based ambient occlusion)
- No texture support (solid colors only)

## Future Enhancements

- [ ] Block interaction (place/break)
- [ ] Collision detection and physics
- [ ] Better terrain generation (Perlin noise)
- [ ] Texture atlas support
- [ ] Water and transparent blocks
- [ ] Dynamic chunk loading/unloading
- [ ] Save/load world data
- [ ] Multiplayer support

## License

MIT License - See LICENSE file for details

## Credits

Built using:
- TypeScript
- WebGPU API
- Greedy meshing algorithm based on voxel rendering research

---

**Note**: This is a minimal implementation focused on demonstrating core voxel engine concepts with clean, understandable code.
