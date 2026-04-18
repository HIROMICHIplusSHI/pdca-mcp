import type { CallToolResult as SdkCallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ApiError } from '../client/api-client.js';

// SDKの型エイリアスとして再エクスポート
export type CallToolResult = SdkCallToolResult;

export function formatSuccess(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

const ERROR_MESSAGES: Record<string, string> = {
  BAD_REQUEST: 'リクエストの形式が不正です。',
  UNAUTHORIZED: 'ログインが必要です。loginツールで認証してください。',
  FORBIDDEN: 'この操作を実行する権限がありません。',
  NOT_FOUND: '指定されたリソースが見つかりません。',
  CONFLICT: '既に同じデータが存在します。',
  VALIDATION_ERROR: '入力内容に問題があります。',
  RATE_LIMITED: 'リクエスト回数の制限に達しました。しばらく待ってから再試行してください。',
  PARSE_ERROR: 'サーバーからの応答を解析できませんでした。',
  SERVER_ERROR: 'サーバーで内部エラーが発生しました。しばらく待ってから再試行してください。',
  NETWORK_ERROR: 'APIサーバーに接続できません。サーバーが起動しているか確認してください。',
  UNKNOWN_ERROR: '予期しないエラーが発生しました。',
};

export async function handleApiCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return formatSuccess(data);
  } catch (e) {
    if (e instanceof ApiError) {
      return formatError(e.code, e.status, e.details);
    }
    return formatError('NETWORK_ERROR', 0);
  }
}

export function formatError(
  code: string,
  status: number,
  details?: Record<string, string[]>
): CallToolResult {
  const message = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN_ERROR;
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: code, status, message, details }),
      },
    ],
    isError: true,
  };
}
