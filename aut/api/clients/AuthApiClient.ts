import { APIRequestContext } from '@playwright/test';
import { BaseApiClient } from '../../../core/base/BaseApiClient';
import { LoginPayload, LoginResponse } from '../types';
import { ENV } from '../../../core/utils/envConfig';

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
