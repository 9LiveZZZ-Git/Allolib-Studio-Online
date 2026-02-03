/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// WebGPU Type Declarations
interface GPUAdapterInfo {
  vendor?: string
  architecture?: string
  device?: string
  description?: string
}

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>
  requestAdapterInfo?(): Promise<GPUAdapterInfo>
}

interface GPUDevice {
  destroy(): void
  // Add more methods as needed
}

interface GPU {
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>
}

interface GPURequestAdapterOptions {
  powerPreference?: 'low-power' | 'high-performance'
}

interface Navigator {
  gpu?: GPU
}
