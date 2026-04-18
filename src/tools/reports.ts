import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { Report, ReportListResponse } from '../types/api-types.js';
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

export function registerReportTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'report_create',
    {
      title: 'レポート作成',
      description: 'PDCAレポートを新規作成する',
      inputSchema: z.object({
        learning_plan: z.string().describe('Plan: 学習計画'),
        learning_do: z.string().optional().describe('Do: 実施内容'),
        learning_check: z.string().optional().describe('Check: 振り返り'),
        learning_action: z.string().optional().describe('Action: 改善策'),
        learning_status: z.enum(['green', 'yellow', 'red']).optional().describe('学習状況'),
        report_date: z.string().optional().describe('報告日（YYYY-MM-DD、省略時は今日）'),
        curriculum_name: z.string().optional().describe('カリキュラム名'),
        code_content: z.string().optional().describe('提出コード'),
      }),
    },
    async (params) => {
      const report = {
        ...params,
        report_date: params.report_date ?? new Date().toISOString().slice(0, 10),
      };
      return handleApiCall(() =>
        apiClient.post<{ report: Report }>('/api/v1/reports', { report })
      );
    }
  );

  server.registerTool(
    'report_today',
    {
      title: '今日のレポート',
      description: '今日のPDCAレポートを取得する',
      inputSchema: z.object({}),
    },
    async () => {
      return handleApiCall(() =>
        apiClient.get<{ report: Report | null }>('/api/v1/reports/today')
      );
    }
  );

  server.registerTool(
    'report_show',
    {
      title: 'レポート取得',
      description: 'IDまたは日付で特定のレポートを取得する',
      inputSchema: z.object({
        id: z.number().optional().describe('レポートID'),
        date: z.string().optional().describe('日付（YYYY-MM-DD）'),
      }),
    },
    async (params) => {
      if (params.id) {
        return handleApiCall(() =>
          apiClient.get<{ report: Report }>(`/api/v1/reports/${params.id}`)
        );
      }
      if (params.date) {
        return handleApiCall(() =>
          apiClient.get<{ report: Report | null }>(`/api/v1/reports/by_date?date=${params.date}`)
        );
      }
      return formatError('VALIDATION_ERROR', 422, {
        params: ['idまたはdateのいずれかを指定してください'],
      });
    }
  );

  server.registerTool(
    'report_list',
    {
      title: 'レポート一覧',
      description: 'PDCAレポートの一覧を取得する',
      inputSchema: z.object({
        month: z.string().optional().describe('月フィルタ（YYYY-MM）'),
        limit: z.number().optional().describe('取得件数（1-100、デフォルト30）'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.month) queryParams.set('month', params.month);
      if (params.limit) queryParams.set('limit', String(params.limit));
      const query = queryParams.toString();
      const path = `/api/v1/reports${query ? `?${query}` : ''}`;
      return handleApiCall(() => apiClient.get<ReportListResponse>(path));
    }
  );

  server.registerTool(
    'report_update',
    {
      title: 'レポート更新',
      description: '既存のPDCAレポートを更新する',
      inputSchema: z.object({
        id: z.number().describe('レポートID'),
        learning_plan: z.string().optional().describe('Plan: 学習計画'),
        learning_do: z.string().optional().describe('Do: 実施内容'),
        learning_check: z.string().optional().describe('Check: 振り返り'),
        learning_action: z.string().optional().describe('Action: 改善策'),
        learning_status: z.enum(['green', 'yellow', 'red']).optional().describe('学習状況'),
        curriculum_name: z.string().optional().describe('カリキュラム名'),
        code_content: z.string().optional().describe('提出コード'),
      }),
    },
    async (params) => {
      const { id, ...reportFields } = params;
      return handleApiCall(() =>
        apiClient.patch<{ report: Report }>(`/api/v1/reports/${id}`, { report: reportFields })
      );
    }
  );
}
