import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import type { AuthManager } from '../auth/auth-manager.js';
import type { LoginResponse } from '../types/api-types.js';
import { formatSuccess, formatError, handleApiCall, type CallToolResult } from '../utils/response.js';
import { classifyHttpError } from '../utils/errors.js';

export function loginHandler(
  authManager: AuthManager
): (params: { email: string; password: string; api_url?: string }) => Promise<CallToolResult> {
  return async ({ email, password, api_url }) => {
    try {
      const targetUrl = api_url ?? authManager.getApiUrl() ?? '';
      if (!targetUrl) {
        return formatError('UNAUTHORIZED', 401, {
          api_url: ['API URLを指定してください'],
        });
      }

      const response = await fetch(`${targetUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let errors: Record<string, string[]> | undefined;
        try {
          const data = await response.json();
          errors = data.errors;
        } catch {
          // 非JSONレスポンスの場合は無視
        }
        return formatError(classifyHttpError(response.status), response.status, errors);
      }

      let data: LoginResponse;
      try {
        data = (await response.json()) as LoginResponse;
      } catch {
        return formatError('PARSE_ERROR', response.status);
      }
      authManager.saveConfig({
        api_url: targetUrl,
        token: data.token,
        user: data.user,
      });

      return formatSuccess({ message: 'ログイン成功', user: data.user });
    } catch {
      return formatError('NETWORK_ERROR', 0);
    }
  };
}

export function logoutHandler(
  authManager: AuthManager
): (params: Record<string, never>) => Promise<CallToolResult> {
  return async () => {
    authManager.deleteConfig();
    return formatSuccess({ message: 'ログアウトしました' });
  };
}

export function whoamiHandler(
  apiClient: ApiClient
): (params: Record<string, never>) => Promise<CallToolResult> {
  return async () => {
    return handleApiCall(() => apiClient.get<{ user: LoginResponse['user'] }>('/api/v1/auth/me'));
  };
}

export function registerAuthTools(
  server: McpServer,
  apiClient: ApiClient,
  authManager: AuthManager
): void {
  server.registerTool(
    'login',
    {
      title: 'ログイン',
      description: 'PDCAアプリにログインしてトークンを保存する',
      inputSchema: z.object({
        email: z.string().describe('メールアドレス'),
        password: z.string().describe('パスワード'),
        api_url: z.string().optional().describe('API URL（初回ログイン時は必須）'),
      }),
    },
    loginHandler(authManager)
  );

  server.registerTool(
    'logout',
    {
      title: 'ログアウト',
      description: '保存済みの認証トークンを削除する',
      inputSchema: z.object({}),
    },
    logoutHandler(authManager)
  );

  server.registerTool(
    'whoami',
    {
      title: '現在のユーザー',
      description: '現在ログイン中のユーザー情報を取得する',
      inputSchema: z.object({}),
    },
    whoamiHandler(apiClient)
  );
}
