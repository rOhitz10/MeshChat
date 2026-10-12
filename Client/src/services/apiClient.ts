export interface HealthCheckResult {
  status: 'online' | 'offline' | 'checking';
  latencyMs?: number;
  serverInfo?: any;
  error?: string;
}

export interface AuthResponse {
  access_token: string;
  userId: string;
  username: string;
  userEmail: string;
}

export class ApiClient {
  private static async requestWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Ping server health and measure roundtrip latency.
   */
  static async checkHealth(baseUrl: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // First try /health
      let url = `${baseUrl.replace(/\/+$/, '')}/health`;
      let res = await this.requestWithTimeout(url, { method: 'GET' }, 3500);

      if (!res.ok && res.status === 404) {
        // Fallback to root /
        url = `${baseUrl.replace(/\/+$/, '')}/`;
        res = await this.requestWithTimeout(url, { method: 'GET' }, 3500);
      }

      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          status: 'online',
          latencyMs,
          serverInfo: data,
        };
      } else {
        return {
          status: 'offline',
          latencyMs,
          error: `HTTP ${res.status}: ${res.statusText}`,
        };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        status: 'offline',
        latencyMs,
        error: err.name === 'AbortError' ? 'Connection timed out' : err.message || 'Cannot reach server',
      };
    }
  }

  /**
   * User login - works identically on Server 1 (NestJS) and Server 2 (FastAPI).
   */
  static async login(baseUrl: string, credentials: { email: string; password: string }): Promise<AuthResponse> {
    const url = `${baseUrl.replace(/\/+$/, '')}/auth/login`;
    const res = await this.requestWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.detail || 'Login failed');
    }
    return data;
  }

  /**
   * User register - works identically on Server 1 and Server 2.
   */
  static async register(
    baseUrl: string,
    userData: { name: string; email: string; password: string }
  ): Promise<AuthResponse> {
    const url = `${baseUrl.replace(/\/+$/, '')}/auth/register`;
    const res = await this.requestWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.detail || 'Registration failed');
    }
    return data;
  }

  /**
   * Fetch current user profile using JWT Bearer token.
   */
  static async getMe(baseUrl: string, token: string): Promise<any> {
    const url = `${baseUrl.replace(/\/+$/, '')}/user/me`;
    const res = await this.requestWithTimeout(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.detail || 'Failed to fetch user profile');
    }
    return data;
  }

  /**
   * List conversations (Server 2 Chat API).
   */
  static async getConversations(baseUrl: string, token: string): Promise<any[]> {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/chats`;
    const res = await this.requestWithTimeout(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.detail || 'Failed to list conversations');
    }
    return data;
  }
}
