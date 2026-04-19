import { APIRequestContext } from '@playwright/test';
import { BaseApiClient } from './BaseApiClient';
import { Cart, CreateCartPayload, UpdateCartPayload } from '../types';
import { ENV } from '../../utils/envConfig';

export class CartsApiClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request, ENV.apiBaseUrl);
  }

  async getAll(limit?: number): Promise<Cart[]> {
    const params = limit ? { limit: String(limit) } : undefined;
    return this.get<Cart[]>('/carts', { params });
  }

  async getById(id: number): Promise<Cart> {
    return this.get<Cart>(`/carts/${id}`);
  }

  async getByUser(userId: number): Promise<Cart[]> {
    return this.get<Cart[]>(`/carts/user/${userId}`);
  }

  async create(payload: CreateCartPayload): Promise<Cart> {
    return this.post<Cart>('/carts', payload);
  }

  async update(id: number, payload: UpdateCartPayload): Promise<Cart> {
    return this.put<Cart>(`/carts/${id}`, payload);
  }

  async partialUpdate(id: number, payload: UpdateCartPayload): Promise<Cart> {
    return this.patch<Cart>(`/carts/${id}`, payload);
  }

  async remove(id: number): Promise<Cart> {
    return this.delete<Cart>(`/carts/${id}`);
  }
}
