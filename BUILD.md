# Build Instructions

This document provides comprehensive instructions for building, running, and deploying AGICraft.

## Prerequisites

### Required Software
- **Node.js**: Version 16.x or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
- **npm**: Usually comes with Node.js
  - Verify installation: `npm --version`

### Browser Requirements
AGICraft requires WebGPU support. Currently supported browsers:

- **Google Chrome/Edge 113+**
  - Enable WebGPU: Navigate to `chrome://flags/`
  - Search for "WebGPU"
  - Enable "Unsafe WebGPU" flag
  - Restart browser

- **Firefox Nightly**
  - Navigate to `about:config`
  - Set `dom.webgpu.enabled` to `true`
  - Restart browser

- **Safari Technology Preview**
  - WebGPU should be enabled by default in recent versions

### Check WebGPU Support
You can verify WebGPU support by opening your browser console and running:
```javascript
if (navigator.gpu) {
    console.log('WebGPU is supported!');
} else {
    console.log('WebGPU is not supported');
}
```

## Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/WholesomeTech/AGICraft.git
cd AGICraft
```

### 2. Install Dependencies
```bash
npm install
```

This will install:
- `@webgpu/types` - TypeScript type definitions for WebGPU
- `typescript` - TypeScript compiler

### 3. Build the Project
```bash
npm run build
```

This command:
1. Runs the TypeScript compiler (`tsc`)
2. Compiles all `.ts` files in `src/` to JavaScript
3. Outputs compiled `.js` files to `dist/`
4. Preserves ES module syntax for browser compatibility

Build output will be in the `dist/` directory.

### 4. Watch Mode (Development)
For active development, use watch mode to automatically recompile on file changes:
```bash
npm run watch
```

This runs `tsc --watch` which monitors source files and recompiles automatically.

## Running Locally

### Option 1: Python HTTP Server (Recommended)
```bash
npm run serve
```

This starts a simple HTTP server on port 8080. Then:
1. Open your browser
2. Navigate to `http://localhost:8080`
3. Click on the canvas to start

### Option 2: Other HTTP Servers

**Using Node.js http-server:**
```bash
npx http-server -p 8080
```

**Using Python 3:**
```bash
python3 -m http.server 8080
```

**Using PHP:**
```bash
php -S localhost:8080
```

### Option 3: Direct File Access
Some browsers allow opening `index.html` directly:
```bash
# On macOS
open index.html

# On Linux
xdg-open index.html

# On Windows
start index.html
```

**Note**: Direct file access may not work due to CORS restrictions. Use an HTTP server for best results.

## Project Structure

```
AGICraft/
├── src/                    # TypeScript source files
│   ├── main.ts            # Entry point, game loop
│   ├── renderer.ts        # WebGPU renderer
│   ├── camera.ts          # First-person camera
│   ├── chunk.ts           # Voxel chunks, greedy meshing
│   ├── math.ts            # Vector/matrix math
│   └── types.ts           # Constants, enums
├── dist/                  # Compiled JavaScript (gitignored)
│   ├── main.js
│   ├── renderer.js
│   ├── camera.js
│   ├── chunk.js
│   ├── math.js
│   └── types.js
├── node_modules/          # Dependencies (gitignored)
├── index.html            # HTML entry point
├── package.json          # Project metadata
├── package-lock.json     # Dependency lock file
├── tsconfig.json         # TypeScript configuration
├── .gitignore           # Git ignore rules
├── README.md            # Main documentation
├── ARCHITECTURE.md      # Technical documentation
└── BUILD.md            # This file
```

## TypeScript Configuration

The `tsconfig.json` configures the TypeScript compiler:

```json
{
  "compilerOptions": {
    "target": "ES2020",           // Output modern JavaScript
    "module": "ES2020",           // Use ES modules
    "lib": ["ES2020", "DOM"],     // Include ES2020 and DOM APIs
    "outDir": "./dist",           // Output directory
    "rootDir": "./src",           // Source directory
    "strict": true,               // Enable all strict checks
    "esModuleInterop": true,      // Better module compatibility
    "skipLibCheck": true,         // Skip .d.ts file checking
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",   // Use Node resolution
    "types": ["@webgpu/types"]    // Include WebGPU types
  }
}
```

## Build Artifacts

### What Gets Built
- All `.ts` files in `src/` → `.js` files in `dist/`
- ES2020 module format (import/export syntax preserved)
- Source maps are NOT generated (add `"sourceMap": true` to tsconfig if needed)

### What's Ignored
The `.gitignore` excludes:
- `node_modules/` - Dependencies
- `dist/` - Build output
- `*.tsbuildinfo` - TypeScript incremental build info
- Editor configs (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`, `Thumbs.db`)

## Deployment

### Static File Hosting

Since AGICraft is a client-side only application, it can be hosted on any static file server:

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Copy required files to your server:**
   - `index.html`
   - `dist/` directory (all .js files)
   
3. **Ensure proper MIME types:**
   - `.js` files should be served as `application/javascript`
   - `.html` files as `text/html`

### Deployment Platforms

#### GitHub Pages
```bash
# Create gh-pages branch
git checkout -b gh-pages

# Build and commit
npm run build
git add dist/ index.html -f
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages

# Enable in repository settings
```

#### Netlify
Create a `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "."

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Vercel
Create a `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".",
  "installCommand": "npm install"
}
```

## Troubleshooting

### Build Issues

**Problem**: `tsc: command not found`
```bash
# Solution: Install TypeScript globally or use npx
npm install -g typescript
# OR
npx tsc
```

**Problem**: Module resolution errors
```bash
# Solution: Ensure .js extensions in imports
# ✓ Good: import { Camera } from './camera.js';
# ✗ Bad:  import { Camera } from './camera';
```

### Runtime Issues

**Problem**: "WebGPU not supported" error
- Ensure you're using a supported browser
- Enable WebGPU flags (see Prerequisites)
- Check `navigator.gpu` in console

**Problem**: Black screen or no rendering
- Open browser console (F12) and check for errors
- Verify all `.js` files loaded correctly (Network tab)
- Check that WebGPU is initialized

**Problem**: Mouse controls not working
- Click the canvas to capture the mouse pointer
- Check browser console for pointer lock errors

**Problem**: Low performance
- Reduce `renderDistance` in `src/main.ts` (generateChunks method)
- Check GPU performance in browser dev tools
- Ensure hardware acceleration is enabled

### Browser Console Debugging

Enable detailed logging:
```javascript
// Add to src/main.ts
console.log('WebGPU adapter:', await navigator.gpu.requestAdapter());
```

## Performance Optimization

### Production Build
For production, consider:
1. Minifying JavaScript (use terser or esbuild)
2. Enabling source maps for debugging
3. Compressing assets with gzip/brotli
4. Using a CDN for static files

### Bundle Size
Current uncompressed sizes:
- Total JavaScript: ~40KB
- index.html: ~2KB
- Total: ~42KB

With gzip compression: ~12KB

## Development Tips

### Hot Reload
For faster development, use:
```bash
# Terminal 1: Watch mode
npm run watch

# Terminal 2: Live server with auto-reload
npx live-server --port=8080
```

### Linting
Add ESLint for code quality:
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### Testing
Add testing framework:
```bash
npm install --save-dev jest @types/jest ts-jest
```

## Additional Resources

- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Greedy Meshing Algorithm](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/)
- [WebGPU Samples](https://webgpu.github.io/webgpu-samples/)

## License

MIT License - See LICENSE file for details
