const API_BASE = '/api/compile'

export interface CompilationResponse {
  success: boolean
  jobId: string
  status: string
  message?: string
  error?: string
}

export interface JobStatusResponse {
  success: boolean
  jobId: string
  status: 'pending' | 'compiling' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  result?: {
    success: boolean
    wasmUrl?: string
    jsUrl?: string
    errors?: string[]
    warnings?: string[]
    duration?: number
  }
}

export async function submitCompilation(source: string): Promise<CompilationResponse> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source }),
  })

  return response.json()
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
