import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import type { DailyGoal, DailyGoalItem } from '../types/api-types.js';
import { handleApiCall } from '../utils/response.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で指定してください');

export function registerDailyGoalTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'daily_show',
    {
      title: '日次目標取得',
      description: '指定日の日次目標を取得する',
      inputSchema: z.object({
        date: dateSchema.describe('日付（YYYY-MM-DD）'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams({ date: params.date });
      return handleApiCall(() =>
        apiClient.get<{ daily_goals: DailyGoal[] }>(`/api/v1/daily_goals?${queryParams}`)
      );
    }
  );

  server.registerTool(
    'daily_list',
    {
      title: '日次目標一覧',
      description: '指定週の日次目標一覧を取得する（週の開始日を指定）',
      inputSchema: z.object({
        week: dateSchema.describe('週の開始日（YYYY-MM-DD）'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams({ week: params.week });
      return handleApiCall(() =>
        apiClient.get<{ daily_goals: DailyGoal[] }>(`/api/v1/daily_goals?${queryParams}`)
      );
    }
  );

  server.registerTool(
    'daily_update',
    {
      title: '日次目標更新',
      description: '日次目標アイテムの内容を更新する',
      inputSchema: z.object({
        daily_goal_id: z.number().describe('日次目標ID'),
        item_id: z.number().describe('アイテムID'),
        content: z.string().describe('更新後の内容'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.patch<{ item: DailyGoalItem }>(
          `/api/v1/daily_goals/${params.daily_goal_id}/items/${params.item_id}`,
          { content: params.content }
        )
      );
    }
  );
}
