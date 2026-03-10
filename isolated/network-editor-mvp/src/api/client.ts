import type {ApiErrorPayload} from '@/types/api';
import type {ApiLogEntry} from '@/types/editor';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Logger = (entry: Omit<ApiLogEntry, 'id' | 'timestamp'>) => void;

export class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export class ApiClient {
  private basePath: string;
  private logger?: Logger;

  constructor(basePath = '/api', logger?: Logger) {
    this.basePath = basePath.replace(/\/$/, '');
    this.logger = logger;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete(path: string): Promise<void> {
    await this.request<void>('DELETE', path);
  }

  private async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const startedAt = performance.now();
    const url = `${this.basePath}${path}`;
    const init: RequestInit = {
      method,
      headers: body === undefined ? undefined : {'Content-Type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body),
    };

    try {
      const response = await fetch(url, init);
      const durationMs = performance.now() - startedAt;
      const responseBody = await this.parseResponse(response);

      this.logger?.({
        method,
        path,
        status: response.status,
        durationMs,
        requestBody: body,
        responseBody,
      });

      if (!response.ok) {
        const errorPayload = (responseBody ?? {}) as ApiErrorPayload;
        throw new ApiRequestError(
          response.status,
          errorPayload.detail || `${method} ${path} failed with ${response.status}`,
          responseBody,
        );
      }

      return responseBody as T;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw error;
      }

      const durationMs = performance.now() - startedAt;
      this.logger?.({
        method,
        path,
        status: 'error',
        durationMs,
        requestBody: body,
        errorMessage: error instanceof Error ? error.message : 'Unknown network error',
      });
      throw error;
    }
  }

  private async parseResponse(response: Response): Promise<unknown> {
    if (response.status === 204) {
      return undefined;
    }

    const text = await response.text();
    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
