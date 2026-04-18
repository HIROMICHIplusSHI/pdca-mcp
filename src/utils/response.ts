import type { CallToolResult as SdkCallToolResult } from '@modelcontextprotocol/sdk/types.js';

// SDKの型エイリアスとして再エクスポート
export type CallToolResult = SdkCallToolResult;

export function formatSuccess(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

export function formatError(
  code: string,
  status: number,
  details?: Record<string, string[]>
): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: code, status, details }),
      },
    ],
    isError: true,
  };
}
