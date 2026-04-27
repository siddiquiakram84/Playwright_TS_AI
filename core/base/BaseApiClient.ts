/**
 * BaseApiClient — foundation for all API test clients.
 *
 * Enterprise features:
 *   - Response time measurement on every call (use assertResponseTime in tests)
 *   - Structured APIResult<T> return type carrying status + headers + body
 *   - Bearer token auth via setAuthToken()
 *   - Consistent error messages with method + URL for fast triage
 */

import { APIRequestContext, APIResponse } from '@playwright/test';
import { logger } from '../utils/logger';

export interface RequestOptions {
  headers?: Record<string, string>;
  params?:  Record<string, string | number | boolean>;
  timeout?: number;
}

/** Full response envelope — status, headers, body, and latency in one object. */
export interface APIResult<T> {
  status:      number;
  ok:          boolean;
  headers:     Record<string, string>;
  body:        T;
  responseTimeMs: number;
}

export class BaseApiClient {
  protected readonly baseUrl: string;
  private authToken?: string;
  /** Milliseconds taken by the last request — readable in tests via lastResponseTimeMs. */
  public lastResponseTimeMs = 0;

  constructor(
    protected readonly request: APIRequestContext,
    baseUrl: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setAuthToken(token: string): void { this.authToken = token; }
  clearAuthToken(): void            { this.authToken = undefined; }

  protected buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept:         'application/json',
      ...extra,
    };
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;
    return headers;
  }

  // ── HTTP verbs ─────────────────────────────────────────────────────────────

  protected async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const res = await this.send<T>('GET', path, undefined, options);
    return res.body;
  }

  protected async post<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    const res = await this.send<T>('POST', path, body, options);
    return res.body;
  }

  protected async put<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    const res = await this.send<T>('PUT', path, body, options);
    return res.body;
  }

  protected async patch<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    const res = await this.send<T>('PATCH', path, body, options);
    return res.body;
  }

  protected async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const res = await this.send<T>('DELETE', path, undefined, options);
    return res.body;
  }

  /**
   * Raw send — returns the full APIResult<T> including status and response time.
   * Use this when the test needs to assert on status codes directly (e.g. 400, 404).
   */
  async sendRaw<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path:   string,
    body?:  unknown,
    options: RequestOptions = {},
  ): Promise<APIResult<T>> {
    return this.send<T>(method, path, body, options);
  }

  // ── Core dispatch ──────────────────────────────────────────────────────────

  private async send<T>(
    method:  string,
    path:    string,
    body?:   unknown,
    options: RequestOptions = {},
  ): Promise<APIResult<T>> {
    const url     = `${this.baseUrl}${path}`;
    const headers = this.buildHeaders(options.headers);

    logger.info(`[API] ${method} ${url}`);
    const start = Date.now();

    let response: APIResponse;
    try {
      response = await this.request.fetch(url, {
        method,
        headers,
        data:    body !== undefined ? JSON.stringify(body) : undefined,
        params:  options.params as Record<string, string | number | boolean>,
        timeout: options.timeout,
      });
    } catch (err) {
      throw new Error(`[API] ${method} ${url} — network error: ${(err as Error).message}`);
    }

    const responseTimeMs = Date.now() - start;
    this.lastResponseTimeMs = responseTimeMs;

    const status     = response.status();
    const rawBody    = await response.text();
    const headersObj = response.headersArray().reduce<Record<string, string>>((acc, h) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {});

    logger.debug(`[API] ${method} ${url} → ${status} (${responseTimeMs}ms)`);

    if (!response.ok()) {
      logger.error(`[API] ${method} ${url} → ${status}: ${rawBody.substring(0, 300)}`);
      throw new Error(`[API] ${method} ${url} → HTTP ${status}: ${rawBody}`);
    }

    let parsed: T;
    try {
      parsed = JSON.parse(rawBody) as T;
    } catch {
      parsed = rawBody as unknown as T;
    }

    return { status, ok: true, headers: headersObj, body: parsed, responseTimeMs };
  }
}
