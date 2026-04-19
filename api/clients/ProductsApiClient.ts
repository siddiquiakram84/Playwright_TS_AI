import { APIRequestContext } from '@playwright/test';
import { BaseApiClient } from './BaseApiClient';
import { Product, CreateProductPayload, UpdateProductPayload } from '../types';
import { ENV } from '../../utils/envConfig';

export class ProductsApiClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request, ENV.apiBaseUrl);
  }

  async getAll(limit?: number): Promise<Product[]> {
    const params = limit ? { limit: String(limit) } : undefined;
    return this.get<Product[]>('/products', { params });
  }

  async getById(id: number): Promise<Product> {
    return this.get<Product>(`/products/${id}`);
  }

  async getByCategory(category: string): Promise<Product[]> {
    return this.get<Product[]>(`/products/category/${encodeURIComponent(category)}`);
  }

  async getCategories(): Promise<string[]> {
    return this.get<string[]>('/products/categories');
  }

  async create(payload: CreateProductPayload): Promise<Product> {
    return this.post<Product>('/products', payload);
  }

  async update(id: number, payload: UpdateProductPayload): Promise<Product> {
    return this.put<Product>(`/products/${id}`, payload);
  }

  async partialUpdate(id: number, payload: UpdateProductPayload): Promise<Product> {
    return this.patch<Product>(`/products/${id}`, payload);
  }

  async remove(id: number): Promise<Product> {
    return this.delete<Product>(`/products/${id}`);
  }
}
