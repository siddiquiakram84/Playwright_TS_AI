import { APIRequestContext } from '@playwright/test';
import { BaseApiClient } from './BaseApiClient';
import { LoginPayload, LoginResponse } from '../types';
import { ENV } from '../../utils/envConfig';

export class AuthApiClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request, ENV.apiBaseUrl);
  }

  async login(payload: LoginPayload): Promise<LoginResponse> {
    return this.post<LoginResponse>('/auth/login', payload);
  }

  async loginAndSetToken(payload: LoginPayload): Promise<string> {
    const { token } = await this.login(payload);
    this.setAuthToken(token);
    return token;
  }
}
