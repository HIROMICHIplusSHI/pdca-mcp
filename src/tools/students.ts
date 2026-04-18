import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client/api-client.js';
import type { StudentSummary, StudentDetail, ReportListResponse, StudentReportDetail } from '../types/api-types.js';
import { handleApiCall } from '../utils/response.js';

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, '月はYYYY-MM形式で指定してください');

export function registerStudentTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'student_list',
    {
      title: '受講生一覧',
      description: '受講生の一覧を取得する（講師専用）',
      inputSchema: z.object({
        status: z.enum(['active', 'inactive']).optional().describe('ステータスフィルタ（デフォルト: active）'),
        team_id: z.number().optional().describe('チームIDフィルタ'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.set('status', params.status);
      if (params.team_id) queryParams.set('team_id', String(params.team_id));
      const query = queryParams.toString();
      const path = `/api/v1/instructor/students${query ? `?${query}` : ''}`;
      return handleApiCall(() =>
        apiClient.get<{ students: StudentSummary[]; total: number }>(path)
      );
    }
  );

  server.registerTool(
    'student_show',
    {
      title: '受講生詳細',
      description: '受講生の詳細情報を取得する（講師専用）',
      inputSchema: z.object({
        id: z.number().describe('受講生ID'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.get<{ student: StudentDetail }>(`/api/v1/instructor/students/${params.id}`)
      );
    }
  );

  server.registerTool(
    'student_reports',
    {
      title: '受講生レポート一覧',
      description: '特定の受講生のレポート一覧を取得する（講師専用）',
      inputSchema: z.object({
        student_id: z.number().describe('受講生ID'),
        month: monthSchema.optional().describe('月フィルタ（YYYY-MM）'),
        limit: z.number().int().min(1).max(100).optional().describe('取得件数'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.month) queryParams.set('month', params.month);
      if (params.limit) queryParams.set('limit', String(params.limit));
      const query = queryParams.toString();
      const path = `/api/v1/instructor/students/${params.student_id}/reports${query ? `?${query}` : ''}`;
      return handleApiCall(() => apiClient.get<ReportListResponse>(path));
    }
  );

  server.registerTool(
    'student_report_show',
    {
      title: '受講生レポート詳細',
      description: '特定の受講生のレポート詳細を取得する（講師専用）。週次目標、コメント、AIレビュー、コード提出を含む。',
      inputSchema: z.object({
        student_id: z.number().describe('受講生ID'),
        report_id: z.number().describe('レポートID'),
      }),
    },
    async (params) => {
      const path = `/api/v1/instructor/students/${params.student_id}/reports/${params.report_id}`;
      return handleApiCall(() => apiClient.get<{ report: StudentReportDetail }>(path));
    }
  );
}
