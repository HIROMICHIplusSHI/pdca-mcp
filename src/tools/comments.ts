import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import type { Comment, AiComment } from '../types/api-types.js';
import { handleApiCall } from '../utils/response.js';

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
      const queryParams = new URLSearchParams({ report_id: String(params.report_id) });
      return handleApiCall(() =>
        apiClient.get<{ comments: Comment[]; ai_comment: AiComment | null }>(
          `/api/v1/comments?${queryParams}`
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
