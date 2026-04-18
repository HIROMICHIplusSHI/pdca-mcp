import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginHandler, logoutHandler, whoamiHandler } from '../../src/tools/auth.js';
import type { ApiClient } from '../../src/client/api-client.js';
import type { AuthManager } from '../../src/auth/auth-manager.js';
import { ApiError } from '../../src/client/api-client.js';

describe('Auth Tools', () => {
  let apiClient: ApiClient;
  let authManager: AuthManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    apiClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as ApiClient;
    authManager = {
      getToken: vi.fn(),
      getApiUrl: vi.fn(),
      getConfig: vi.fn(),
      saveConfig: vi.fn(),
      deleteConfig: vi.fn(),
    } as unknown as AuthManager;
  });

  describe('loginHandler', () => {
    it('ログイン成功時にトークンを保存して結果を返す', async () => {
      const loginResponse = {
        token: 'new-token',
        user: { id: 1, name: '田中', email: 'tanaka@example.com', role: 'student' },
      };
      const mockFetchResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(loginResponse),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse));

      const handler = loginHandler(authManager);
      const result = await handler({
        email: 'tanaka@example.com',
        password: 'pass123',
        api_url: 'https://example.com',
      });

      expect(authManager.saveConfig).toHaveBeenCalledWith({
        api_url: 'https://example.com',
        token: 'new-token',
        user: loginResponse.user,
      });
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.user.name).toBe('田中');
    });

    it('ログイン失敗時にエラーを返す', async () => {
      const mockFetchResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: 'Invalid credentials' }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse));

      const handler = loginHandler(authManager);
      const result = await handler({
        email: 'wrong@example.com',
        password: 'wrong',
        api_url: 'https://example.com',
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('UNAUTHORIZED');
    });

    it('API URL未指定でgetApiUrlもnullの場合エラーを返す', async () => {
      (authManager.getApiUrl as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const handler = loginHandler(authManager);
      const result = await handler({
        email: 'test@example.com',
        password: 'pass',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('logoutHandler', () => {
    it('設定ファイルを削除してメッセージを返す', async () => {
      const handler = logoutHandler(authManager);
      const result = await handler({});

      expect(authManager.deleteConfig).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
    });
  });

  describe('whoamiHandler', () => {
    it('ユーザー情報を返す', async () => {
      const userResponse = {
        user: { id: 1, name: '田中', email: 'tanaka@example.com', role: 'student' },
      };
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(userResponse);

      const handler = whoamiHandler(apiClient);
      const result = await handler({});

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.user.name).toBe('田中');
    });

    it('未認証時にエラーを返す', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError('UNAUTHORIZED', 401)
      );

      const handler = whoamiHandler(apiClient);
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });
});
