import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import type { DashboardDailyResponse } from '../types/api-types.js';
import { handleApiCall } from '../utils/response.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で指定してください');

export function registerDashboardTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'dashboard_daily',
    {
      title: '日次ダッシュボード',
      description: '日次の報告サマリと受講生一覧を取得する（講師専用）',
      inputSchema: z.object({
        date: dateSchema.optional().describe('日付（YYYY-MM-DD、デフォルト: 昨日）'),
        team_id: z.number().optional().describe('チームIDフィルタ'),
        status: z.enum(['green', 'yellow', 'red', 'not_submitted']).optional().describe('ステータスフィルタ'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.date) queryParams.set('date', params.date);
      if (params.team_id) queryParams.set('team_id', String(params.team_id));
      if (params.status) queryParams.set('status', params.status);
      const query = queryParams.toString();
      const path = `/api/v1/instructor/dashboard/daily${query ? `?${query}` : ''}`;
      return handleApiCall(() => apiClient.get<DashboardDailyResponse>(path));
    }
  );
}
