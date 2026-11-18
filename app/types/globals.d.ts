interface ApiOptions {
  headers?: Record<string, string>
  credentials?: RequestCredentials
  // Abort after this many milliseconds. 0 or omitted means no timeout.
  timeout?: number
  signal?: AbortSignal
}

interface TylixApiResult<T = any> {
  ok: boolean
  status: number
  data: T
  error: string | null
}

declare function useApi<T = any>(
  url: string,
  options?: ApiOptions & { method?: string; body?: unknown }
): Promise<TylixApiResult<T>>

declare function reactive<T extends object>(state: T): T

declare function notFound(): void
