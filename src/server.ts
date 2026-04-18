import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AuthManager } from './auth/auth-manager.js';
import { ApiClient } from './client/api-client.js';
import { registerAuthTools } from './tools/auth.js';
import { registerReportTools } from './tools/reports.js';
import { registerGoalTools } from './tools/goals.js';
import { registerPlanTools } from './tools/plans.js';
import { registerCommentTools } from './tools/comments.js';
import { registerStudentTools } from './tools/students.js';
import { registerProgressTools } from './tools/progress.js';
import { registerDashboardTools } from './tools/dashboard.js';
import { registerStudyTimeTools } from './tools/study-times.js';
import { registerDailyGoalTools } from './tools/daily-goals.js';

export function createServer(): {
  server: McpServer;
  authManager: AuthManager;
  apiClient: ApiClient;
} {
  const server = new McpServer({
    name: 'pdca-mcp',
    version: '1.0.0',
  });

  const authManager = new AuthManager();
  const apiClient = new ApiClient(authManager);

  registerAuthTools(server, apiClient, authManager);
  registerReportTools(server, apiClient);
  registerGoalTools(server, apiClient);
  registerPlanTools(server, apiClient);
  registerCommentTools(server, apiClient);
  registerStudentTools(server, apiClient);
  registerProgressTools(server, apiClient);
  registerDashboardTools(server, apiClient);
  registerStudyTimeTools(server, apiClient);
  registerDailyGoalTools(server, apiClient);

  return { server, authManager, apiClient };
}
