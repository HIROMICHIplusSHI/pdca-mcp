import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import type { WeeklyGoal } from '../types/api-types.js';
import { formatSuccess, formatError, handleApiCall } from '../utils/response.js';
import { ApiError } from '../client/api-client.js';
import { syncReportLearningPlanForWeek } from '../utils/sync-report-learning-plan.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で指定してください');

export function registerGoalTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'goal_create',
    {
      title: '週次目標作成',
      description: '新しい週次目標を作成する',
      inputSchema: z.object({
        items: z.array(z.object({
          content: z.string().describe('目標の内容'),
          category_id: z.number().optional().describe('カテゴリID'),
        })).max(10).describe('目標項目リスト（最大10件）'),
        week_start: dateSchema.optional().describe('週の開始日（YYYY-MM-DD）'),
        force: z.boolean().optional().describe('既存の目標を上書きするか'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<{ weekly_goal: WeeklyGoal }>('/api/v1/weekly_goals', params)
      );
    }
  );

  server.registerTool(
    'goal_current',
    {
      title: '今週の目標',
      description: '今週の週次目標を取得する',
      inputSchema: z.object({}),
    },
    async () => {
      return handleApiCall(() =>
        apiClient.get<{ weekly_goal: WeeklyGoal | null }>('/api/v1/weekly_goals/current')
      );
    }
  );

  server.registerTool(
    'goal_list',
    {
      title: '目標一覧',
      description: '週次目標の一覧を取得する',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional().describe('取得件数（1-50、デフォルト10）'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.set('limit', String(params.limit));
      const query = queryParams.toString();
      return handleApiCall(() =>
        apiClient.get<{ weekly_goals: WeeklyGoal[] }>(`/api/v1/weekly_goals${query ? `?${query}` : ''}`)
      );
    }
  );

  server.registerTool(
    'goal_update',
    {
      title: '目標更新',
      description: '週次目標のアイテムを更新する（内容や進捗率）',
      inputSchema: z.object({
        id: z.number().describe('週次目標ID'),
        items: z.array(z.object({
          id: z.number().describe('アイテムID'),
          content: z.string().optional().describe('更新後の内容'),
          progress: z.number().min(0).max(100).optional().describe('進捗率（0-100）'),
        })).describe('更新するアイテム'),
      }),
    },
    async (params) => {
      const { id, items } = params;
      try {
        const response = await apiClient.patch<{ weekly_goal: WeeklyGoal }>(
          `/api/v1/weekly_goals/${id}`,
          { items }
        );
        // goal_update 後、バックエンドが pdca_reports_controller 経由で
        // report.learning_plan を daily_goal_items.first.content で上書きしうるため、
        // 正しい値が learning_plan に残るよう週範囲を再同期する。
        // (詳細: https://github.com/HIROMICHIplusSHI/pdca-mcp/issues/3)
        const goal = response?.weekly_goal;
        if (goal?.week_start_date && goal?.week_end_date) {
          await syncReportLearningPlanForWeek(
            apiClient,
            goal.week_start_date,
            goal.week_end_date
          );
        }
        return formatSuccess(response);
      } catch (e) {
        if (e instanceof ApiError) {
          return formatError(e.code, e.status, e.details);
        }
        return formatError('NETWORK_ERROR', 0);
      }
    }
  );
}
