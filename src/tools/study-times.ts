import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import type { StudyTimeResponse } from '../types/api-types.js';
import { handleApiCall } from '../utils/response.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で指定してください');

export function registerStudyTimeTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'study_show',
    {
      title: '学習時間取得',
      description: '指定日の学習時間（予定・実績スロット）を取得する',
      inputSchema: z.object({
        date: dateSchema.describe('日付（YYYY-MM-DD）'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams({ date: params.date });
      return handleApiCall(() =>
        apiClient.get<StudyTimeResponse>(`/api/v1/study_times?${queryParams}`)
      );
    }
  );

  server.registerTool(
    'study_log',
    {
      title: '学習時間記録',
      description: '指定日の学習時間スロットを記録する（既存スロットは上書き）',
      inputSchema: z.object({
        date: dateSchema.describe('日付（YYYY-MM-DD）'),
        slots: z.array(z.string()).describe('時間スロット（例: ["09:00-12:00", "14:00-17:00"]）'),
        slot_type: z.enum(['actual', 'planned']).optional().describe('スロット種別（デフォルト: actual）'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<StudyTimeResponse>('/api/v1/study_times', {
          date: params.date,
          slots: params.slots,
          slot_type: params.slot_type ?? 'actual',
        })
      );
    }
  );
}
