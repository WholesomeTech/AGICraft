import { Camera } from './camera.js';
import { Chunk } from './chunk.js';

/**
 * WebGPU Renderer for voxel terrain
 */
export class Renderer {
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private uniformBuffer!: GPUBuffer;
    private bindGroup!: GPUBindGroup;
    private depthTexture!: GPUTexture;
    
    // Chunk rendering
    private chunkBuffers: Map<string, GPUBuffer> = new Map();
    private chunkVertexCounts: Map<string, number> = new Map();

    constructor(private canvas: HTMLCanvasElement) {}

    /**
     * Initialize WebGPU
     */
    async init(): Promise<void> {
        // Check WebGPU support
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported in this browser');
        }

        // Get adapter and device
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('No GPU adapter found');
        }

        this.device = await adapter.requestDevice();
        
        // Configure canvas context
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: format,
            alphaMode: 'opaque',
        });

        // Create depth texture
        this.createDepthTexture();

        // Create uniform buffer for view-projection matrix and lighting
        // 64 (mat4) + 16 (lightDir) + 16 (ambient) + 16 (sun) = 112 bytes
        // Aligned to 16 bytes
        this.uniformBuffer = this.device.createBuffer({
            size: 112, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Create bind group layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' },
            }],
        });

        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer },
            }],
        });

        // Create render pipeline
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        const shaderModule = this.device.createShaderModule({
            code: this.getShaderCode(),
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertex_main',
                buffers: [{
                    arrayStride: 36, // 9 floats * 4 bytes: position(3) + normal(3) + color(3)
                    attributes: [
                        {
                            // position
                            format: 'float32x3',
                            offset: 0,
                            shaderLocation: 0,
                        },
                        {
                            // normal
                            format: 'float32x3',
                            offset: 12,
                            shaderLocation: 1,
                        },
                        {
                            // color
                            format: 'float32x3',
                            offset: 24,
                            shaderLocation: 2,
                        },
                    ],
                }],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragment_main',
                targets: [{
                    format: format,
                }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });
    }

    /**
     * Create depth texture for depth testing
     */
    private createDepthTexture(): void {
        if (this.depthTexture) {
            this.depthTexture.destroy();
        }

        this.depthTexture = this.device.createTexture({
            size: {
                width: this.canvas.width,
                height: this.canvas.height,
            },
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    /**
     * Handle canvas resize
     */
    resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
        this.createDepthTexture();
    }

    /**
     * Update chunk mesh buffer
     */
    updateChunk(chunk: Chunk): void {
        const key = `${chunk.x},${chunk.z}`;
        
        // Remove old buffer if exists
        const oldBuffer = this.chunkBuffers.get(key);
        if (oldBuffer) {
            oldBuffer.destroy();
        }

        if (!chunk.vertices || chunk.vertices.length === 0) {
            this.chunkBuffers.delete(key);
            this.chunkVertexCounts.delete(key);
            return;
        }

        // Create new vertex buffer
        const buffer = this.device.createBuffer({
            size: chunk.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // Safe write with proper type
        this.device.queue.writeBuffer(buffer, 0, chunk.vertices.buffer, chunk.vertices.byteOffset, chunk.vertices.byteLength);
        
        this.chunkBuffers.set(key, buffer);
        this.chunkVertexCounts.set(key, chunk.vertexCount);
    }

    /**
     * Render frame
     */
    render(
        camera: Camera, 
        chunks: Chunk[], 
        lightDir: {x: number, y: number, z: number},
        ambientColor: {r: number, g: number, b: number},
        sunColor: {r: number, g: number, b: number},
        skyColor: {r: number, g: number, b: number}
    ): void {
        // Update uniform buffer
        const vpMatrix = camera.getViewProjectionMatrix();
        
        // Data layout:
        // Mat4 viewProj (64)
        // Vec3 lightDir + padding (16)
        // Vec3 ambient + padding (16)
        // Vec3 sunColor + padding (16)
        
        const uniformData = new Float32Array(28); // 16 + 4 + 4 + 4
        uniformData.set(vpMatrix.data, 0); // 0-15
        
        uniformData[16] = lightDir.x;
        uniformData[17] = lightDir.y;
        uniformData[18] = lightDir.z;
        uniformData[19] = 0; // pad

        uniformData[20] = ambientColor.r;
        uniformData[21] = ambientColor.g;
        uniformData[22] = ambientColor.b;
        uniformData[23] = 0; // pad

        uniformData[24] = sunColor.r;
        uniformData[25] = sunColor.g;
        uniformData[26] = sunColor.b;
        uniformData[27] = 0; // pad
        
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData.buffer, uniformData.byteOffset, uniformData.byteLength);

        // Create command encoder
        const encoder = this.device.createCommandEncoder();
        
        const textureView = this.context.getCurrentTexture().createView();
        
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: skyColor.r, g: skyColor.g, b: skyColor.b, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);

        // Render all chunks
        for (const chunk of chunks) {
            const key = `${chunk.x},${chunk.z}`;
            const buffer = this.chunkBuffers.get(key);
            const vertexCount = this.chunkVertexCounts.get(key);
            
            if (buffer && vertexCount) {
                renderPass.setVertexBuffer(0, buffer);
                renderPass.draw(vertexCount);
            }
        }

        renderPass.end();
        
        this.device.queue.submit([encoder.finish()]);
    }

    /**
     * WGSL Shader code
     */
    private getShaderCode(): string {
        return `
struct Uniforms {
    viewProjection: mat4x4<f32>,
    lightDir: vec4<f32>, // vec3 + padding
    ambientColor: vec4<f32>, // vec3 + padding
    sunColor: vec4<f32>, // vec3 + padding
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) color: vec3<f32>,
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = uniforms.viewProjection * vec4<f32>(input.position, 1.0);
    output.normal = input.normal;
    output.color = input.color;
    return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Normalize vectors
    let normal = normalize(input.normal);
    let lightDir = normalize(uniforms.lightDir.xyz);
    
    // Diffuse lighting (Lambert)
    // max(dot(N, L), 0.0)
    let diffuse = max(dot(normal, lightDir), 0.0);
    
    // Combine lighting
    let lighting = uniforms.ambientColor.rgb + (diffuse * uniforms.sunColor.rgb);
    
    // Apply to object color
    let finalColor = input.color * lighting;
    
    return vec4<f32>(finalColor, 1.0);
}
`;
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        for (const buffer of this.chunkBuffers.values()) {
            buffer.destroy();
        }
        this.chunkBuffers.clear();
        this.chunkVertexCounts.clear();
        
        if (this.uniformBuffer) this.uniformBuffer.destroy();
        if (this.depthTexture) this.depthTexture.destroy();
    }
}
