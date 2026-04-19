import { APIRequestContext, APIResponse } from '@playwright/test';
import { logger } from '../../utils/logger';

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
}

export class BaseApiClient {
  protected readonly baseUrl: string;
  private authToken?: string;

  constructor(
    protected readonly request: APIRequestContext,
    baseUrl: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  protected buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...extra,
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  protected async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.info(`GET ${url}`);
    const response = await this.request.get(url, {
      headers: this.buildHeaders(options.headers),
      params: options.params as Record<string, string>,
      timeout: options.timeout,
    });
    return this.handleResponse<T>(response, 'GET', url);
  }

  protected async post<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.info(`POST ${url}`);
    const response = await this.request.post(url, {
      headers: this.buildHeaders(options.headers),
      data: body,
      timeout: options.timeout,
    });
    return this.handleResponse<T>(response, 'POST', url);
  }

  protected async put<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.info(`PUT ${url}`);
    const response = await this.request.put(url, {
      headers: this.buildHeaders(options.headers),
      data: body,
      timeout: options.timeout,
    });
    return this.handleResponse<T>(response, 'PUT', url);
  }

  protected async patch<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.info(`PATCH ${url}`);
    const response = await this.request.patch(url, {
      headers: this.buildHeaders(options.headers),
      data: body,
      timeout: options.timeout,
    });
    return this.handleResponse<T>(response, 'PATCH', url);
  }

  protected async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.info(`DELETE ${url}`);
    const response = await this.request.delete(url, {
      headers: this.buildHeaders(options.headers),
      timeout: options.timeout,
    });
    return this.handleResponse<T>(response, 'DELETE', url);
  }

  private async handleResponse<T>(
    response: APIResponse,
    method: string,
    url: string,
  ): Promise<T> {
    const status = response.status();
    const body = await response.text();

    logger.debug(`${method} ${url} → ${status}`);

    if (!response.ok()) {
      logger.error(`API Error ${status}: ${body}`);
      throw new Error(`API ${method} ${url} failed with status ${status}: ${body}`);
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      return body as unknown as T;
    }
  }
}
