import { APIRequestContext } from '@playwright/test';
import { BaseApiClient } from './BaseApiClient';
import { User, CreateUserPayload, UpdateUserPayload } from '../types';
import { ENV } from '../../utils/envConfig';

export class UsersApiClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request, ENV.apiBaseUrl);
  }

  async getAll(limit?: number): Promise<User[]> {
    const params = limit ? { limit: String(limit) } : undefined;
    return this.get<User[]>('/users', { params });
  }

  async getById(id: number): Promise<User> {
    return this.get<User>(`/users/${id}`);
  }

  async create(payload: CreateUserPayload): Promise<User> {
    return this.post<User>('/users', payload);
  }

  async update(id: number, payload: UpdateUserPayload): Promise<User> {
    return this.put<User>(`/users/${id}`, payload);
  }

  async partialUpdate(id: number, payload: UpdateUserPayload): Promise<User> {
    return this.patch<User>(`/users/${id}`, payload);
  }

  async remove(id: number): Promise<User> {
    return this.delete<User>(`/users/${id}`);
  }
}
