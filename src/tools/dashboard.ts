import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { DashboardDailyResponse } from '../types/api-types.js';
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

export function registerDashboardTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'dashboard_daily',
    {
      title: '日次ダッシュボード',
      description: '日次の報告サマリと受講生一覧を取得する（講師専用）',
      inputSchema: z.object({
        date: z.string().optional().describe('日付（YYYY-MM-DD、デフォルト: 昨日）'),
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
