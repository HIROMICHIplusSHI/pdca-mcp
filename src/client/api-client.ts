import type { AuthManager } from '../auth/auth-manager.js';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, string[]>
  ) {
    super(`API Error: ${code} (${status})`);
    this.name = 'ApiError';
  }
}

function classifyError(status: number): string {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'VALIDATION_ERROR';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN_ERROR';
}

export class ApiClient {
  constructor(private readonly authManager: AuthManager) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T | null> {
    const apiUrl = this.authManager.getApiUrl();
    if (!apiUrl) {
      throw new ApiError('UNAUTHORIZED', 401);
    }

    const token = this.authManager.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${apiUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError('NETWORK_ERROR', 0);
    }

    if (response.status === 204) {
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      const code = classifyError(response.status);
      const details = data.errors as Record<string, string[]> | undefined;
      throw new ApiError(code, response.status, details);
    }

    return data as T;
  }

  async get<T>(path: string): Promise<T | null> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T | null> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body: unknown): Promise<T | null> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<T | null> {
    return this.request<T>('DELETE', path);
  }
}
