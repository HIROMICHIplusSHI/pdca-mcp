import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import type { Plan, PlanCategory } from '../types/api-types.js';
import { handleApiCall } from '../utils/response.js';

export function registerPlanTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'plan_setup',
    {
      title: '学習計画セットアップ',
      description: '新しい学習計画を作成する（カテゴリと見積もり時間を設定）',
      inputSchema: z.object({
        course_name: z.string().optional().describe('コース名'),
        categories: z.array(z.object({
          name: z.string().describe('カテゴリ名'),
          estimated_hours: z.number().min(0).describe('見積もり時間'),
        })).describe('学習カテゴリ'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<{ plan: Plan }>('/api/v1/plan/setup', params)
      );
    }
  );

  server.registerTool(
    'plan_show',
    {
      title: '学習計画取得',
      description: '現在の学習計画とカテゴリ進捗を取得する',
      inputSchema: z.object({}),
    },
    async () => {
      return handleApiCall(() =>
        apiClient.get<{ plan: Plan | null }>('/api/v1/plan')
      );
    }
  );

  server.registerTool(
    'plan_add_category',
    {
      title: 'カテゴリ追加',
      description: '学習計画にカテゴリを追加する',
      inputSchema: z.object({
        name: z.string().describe('カテゴリ名'),
        estimated_hours: z.number().min(0).describe('見積もり時間'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<{ category: PlanCategory; plan: Plan }>('/api/v1/plan/categories', params)
      );
    }
  );
}
