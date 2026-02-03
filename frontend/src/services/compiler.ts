const API_BASE = '/api/compile'

export type BackendType = 'webgl2' | 'webgpu'

export interface ProjectFile {
  name: string
  content: string
}

export interface CompilationRequest {
  files: ProjectFile[]
  mainFile?: string
  backend?: BackendType
}

export interface CompilationResponse {
  success: boolean
  jobId: string
  status: string
  backend?: BackendType
  message?: string
  error?: string
}

export interface JobStatusResponse {
  success: boolean
  jobId: string
  status: 'pending' | 'compiling' | 'completed' | 'failed'
  backend?: BackendType
  createdAt: string
  completedAt?: string
  result?: {
    success: boolean
    wasmUrl?: string
    jsUrl?: string
    errors?: string[]
    warnings?: string[]
    duration?: number
    backend?: BackendType
  }
}

/**
 * Submit a multi-file project for compilation
 */
export async function submitCompilation(request: CompilationRequest): Promise<CompilationResponse> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: request.files,
      mainFile: request.mainFile || 'main.cpp',
      backend: request.backend || 'webgl2',
    }),
  })

  return response.json()
}

/**
 * Legacy single-file compilation (for backward compatibility)
 */
export async function submitSingleFileCompilation(source: string): Promise<CompilationResponse> {
  return submitCompilation({
    files: [{ name: 'main.cpp', content: source }],
    mainFile: 'main.cpp',
  })
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${API_BASE}/status/${jobId}`)
  return response.json()
}

export async function pollJobCompletion(
  jobId: string,
  onProgress?: (status: string) => void,
  maxAttempts = 60,
  interval = 1000
): Promise<JobStatusResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getJobStatus(jobId)

    if (onProgress) {
      onProgress(status.status)
    }

    if (status.status === 'completed' || status.status === 'failed') {
      return status
    }

    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error('Compilation timed out')
}

export async function cleanupJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/${jobId}`, { method: 'DELETE' })
}
