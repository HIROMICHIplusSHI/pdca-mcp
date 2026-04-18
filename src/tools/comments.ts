import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { Comment, AiComment } from '../types/api-types.js';
import { formatSuccess, formatError, type CallToolResult } from '../utils/response.js';

async function handleApiCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
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

export function registerCommentTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'comment_list',
    {
      title: 'コメント一覧',
      description: '指定レポートへのコメント一覧を取得する',
      inputSchema: z.object({
        report_id: z.number().describe('レポートID'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.get<{ comments: Comment[]; ai_comment: AiComment | null }>(
          `/api/v1/comments?report_id=${params.report_id}`
        )
      );
    }
  );

  server.registerTool(
    'comment_create',
    {
      title: 'コメント作成',
      description: 'レポートにコメントを追加する',
      inputSchema: z.object({
        report_id: z.number().describe('レポートID'),
        content: z.string().describe('コメント内容'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<{ comment: Comment }>('/api/v1/comments', params)
      );
    }
  );

  server.registerTool(
    'comment_delete',
    {
      title: 'コメント削除',
      description: 'コメントを削除する',
      inputSchema: z.object({
        id: z.number().describe('コメントID'),
      }),
    },
    async (params) => {
      return handleApiCall(() => apiClient.delete(`/api/v1/comments/${params.id}`));
    }
  );
}
