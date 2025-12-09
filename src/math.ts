/**
 * 3D Vector utilities
 */
export class Vec3 {
    constructor(
        public x: number = 0,
        public y: number = 0,
        public z: number = 0
    ) {}

    static add(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    static subtract(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    static scale(v: Vec3, s: number): Vec3 {
        return new Vec3(v.x * s, v.y * s, v.z * s);
    }

    static normalize(v: Vec3): Vec3 {
        const lenSq = v.x * v.x + v.y * v.y + v.z * v.z;
        if (lenSq === 0) return new Vec3();
        const len = Math.sqrt(lenSq);
        return new Vec3(v.x / len, v.y / len, v.z / len);
    }

    static cross(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x
        );
    }
}

/**
 * 4x4 Matrix utilities for transformations
 */
export class Mat4 {
    data: Float32Array;

    constructor(data?: Float32Array) {
        this.data = data || new Float32Array(16);
        if (!data) {
            this.identity();
        }
    }

    identity(): Mat4 {
        this.data.fill(0);
        this.data[0] = this.data[5] = this.data[10] = this.data[15] = 1;
        return this;
    }

    static perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
        const mat = new Mat4();
        const f = 1.0 / Math.tan(fov / 2);
        
        // WebGPU uses [0, 1] depth range
        // Z_ndc = f/(f-n) - nf/(f-n)/z
        
        mat.data[0] = f / aspect;
        mat.data[5] = f;
        mat.data[10] = far / (near - far); // -f / (f - n)
        mat.data[11] = -1;
        mat.data[14] = (near * far) / (near - far); // -nf / (f - n)
        mat.data[15] = 0;

        return mat;
    }

    static lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
        const z = Vec3.normalize(Vec3.subtract(eye, target));
        const x = Vec3.normalize(Vec3.cross(up, z));
        const y = Vec3.cross(z, x);

        const mat = new Mat4();
        mat.data[0] = x.x;
        mat.data[1] = y.x;
        mat.data[2] = z.x;
        mat.data[3] = 0;

        mat.data[4] = x.y;
        mat.data[5] = y.y;
        mat.data[6] = z.y;
        mat.data[7] = 0;

        mat.data[8] = x.z;
        mat.data[9] = y.z;
        mat.data[10] = z.z;
        mat.data[11] = 0;

        mat.data[12] = -(x.x * eye.x + x.y * eye.y + x.z * eye.z);
        mat.data[13] = -(y.x * eye.x + y.y * eye.y + y.z * eye.z);
        mat.data[14] = -(z.x * eye.x + z.y * eye.y + z.z * eye.z);
        mat.data[15] = 1;

        return mat;
    }

    static multiply(a: Mat4, b: Mat4): Mat4 {
        const result = new Mat4();
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += a.data[i * 4 + k] * b.data[k * 4 + j];
                }
                result.data[i * 4 + j] = sum;
            }
        }
        return result;
    }
}
