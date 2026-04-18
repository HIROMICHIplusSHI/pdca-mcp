import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from '../src/client/api-client.js';
import { AuthManager } from '../src/auth/auth-manager.js';

describe('ApiClient', () => {
  let authManager: AuthManager;
  let apiClient: ApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    authManager = {
      getToken: vi.fn().mockReturnValue('test-token'),
      getApiUrl: vi.fn().mockReturnValue('https://example.com'),
      getConfig: vi.fn(),
      saveConfig: vi.fn(),
      deleteConfig: vi.fn(),
    } as unknown as AuthManager;
    apiClient = new ApiClient(authManager);
  });

  describe('request', () => {
    it('正しいURLとヘッダーでリクエストを送信する', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ user: { id: 1 } }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await apiClient.get('/api/v1/auth/me');

      expect(fetch).toHaveBeenCalledWith('https://example.com/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: undefined,
      });
      expect(result).toEqual({ user: { id: 1 } });
    });

    it('トークンなしでもリクエストできる（login用）', async () => {
      (authManager.getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ token: 'new-token' }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await apiClient.post('/api/v1/auth/login', {
        email: 'test@example.com',
        password: 'pass',
      });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
      expect(result).toEqual({ token: 'new-token' });
    });

    it('POSTリクエストでbodyを送信する', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue({ report: { id: 1 } }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await apiClient.post('/api/v1/reports', {
        report: { learning_plan: 'テスト' },
      });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe(
        JSON.stringify({ report: { learning_plan: 'テスト' } })
      );
    });

    it('APIエラー時にApiErrorをthrowする', async () => {
      const mockResponse = {
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({ errors: { learning_plan: ['を入力してください'] } }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      try {
        await apiClient.post('/api/v1/reports', {});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const err = e as ApiError;
        expect(err.status).toBe(422);
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.details).toEqual({ learning_plan: ['を入力してください'] });
      }
    });

    it('ネットワークエラー時にApiErrorをthrowする', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));

      try {
        await apiClient.get('/api/v1/auth/me');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const err = e as ApiError;
        expect(err.code).toBe('NETWORK_ERROR');
      }
    });

    it('API URLが未設定の場合エラーをthrowする', async () => {
      (authManager.getApiUrl as ReturnType<typeof vi.fn>).mockReturnValue(null);

      try {
        await apiClient.get('/api/v1/auth/me');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const err = e as ApiError;
        expect(err.code).toBe('UNAUTHORIZED');
      }
    });

    it('204 No Content の場合はnullを返す', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        json: vi.fn(),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await apiClient.delete('/api/v1/comments/1');
      expect(result).toBeNull();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});
