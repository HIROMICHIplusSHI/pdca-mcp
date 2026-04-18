import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import type { ProgressStudent, ProgressDetail } from '../types/api-types.js';
import { handleApiCall } from '../utils/response.js';

export function registerProgressTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'progress_list',
    {
      title: '進捗一覧',
      description: '受講生の進捗一覧を取得する（講師専用）',
      inputSchema: z.object({
        team_id: z.number().optional().describe('チームIDフィルタ'),
      }),
    },
    async (params) => {
      const query = params.team_id ? `?team_id=${params.team_id}` : '';
      return handleApiCall(() =>
        apiClient.get<{ students: ProgressStudent[] }>(`/api/v1/instructor/progress${query}`)
      );
    }
  );

  server.registerTool(
    'progress_show',
    {
      title: '進捗詳細',
      description: '受講生の詳細な進捗情報を取得する（講師専用）',
      inputSchema: z.object({
        student_id: z.number().describe('受講生ID'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.get<ProgressDetail>(`/api/v1/instructor/progress/${params.student_id}`)
      );
    }
  );
}
