import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ApiClient } from '../../src/client/api-client.js';
import { createMockServer } from '../helpers/mock-server.js';
import { registerReportTools } from '../../src/tools/reports.js';
import { registerGoalTools } from '../../src/tools/goals.js';
import { registerPlanTools } from '../../src/tools/plans.js';
import { registerStudentTools } from '../../src/tools/students.js';
import { registerDailyGoalTools } from '../../src/tools/daily-goals.js';
import { registerCommentTools } from '../../src/tools/comments.js';
import { registerDashboardTools } from '../../src/tools/dashboard.js';

// 各ツールのURL組み立て・パラメータ渡しを smoke test で検証する

function createApiClientMock(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(null),
  } as unknown as ApiClient;
}

describe('Report Tools', () => {
  let apiClient: ApiClient;
  let mock: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    apiClient = createApiClientMock();
    mock = createMockServer();
    registerReportTools(mock.server, apiClient);
  });

  it('report_create: /api/v1/reports に POST し、report_date 未指定時は今日のJSTが入る', async () => {
    await mock.getHandler('report_create')({ learning_plan: 'テスト' });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [path, body] = (apiClient.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe('/api/v1/reports');
    expect(body.report.learning_plan).toBe('テスト');
    expect(body.report.report_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('report_today: /api/v1/reports/today を GET', async () => {
    await mock.getHandler('report_today')({});
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports/today');
  });

  it('report_show(id): /api/v1/reports/:id を GET', async () => {
    await mock.getHandler('report_show')({ id: 42 });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports/42');
  });

  it('report_show(date): /api/v1/reports/by_date?date=... を GET', async () => {
    await mock.getHandler('report_show')({ date: '2026-04-01' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports/by_date?date=2026-04-01');
  });

  it('report_list: month/limit がクエリに入る', async () => {
    await mock.getHandler('report_list')({ month: '2026-04', limit: 5 });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports?month=2026-04&limit=5');
  });

  it('report_list: 引数なしでも動く', async () => {
    await mock.getHandler('report_list')({});
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports');
  });

  it('report_update: /api/v1/reports/:id に PATCH（idはbody外）', async () => {
    await mock.getHandler('report_update')({ id: 7, learning_check: '更新' });
    const [path, body] = (apiClient.patch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe('/api/v1/reports/7');
    expect(body).toEqual({ report: { learning_check: '更新' } });
  });

  it('report_show: idとdate両方指定で isError を返す', async () => {
    const result = await mock.getHandler('report_show')({ id: 1, date: '2026-04-01' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('いずれか一方');
  });

  it('report_show: id/date どちらも未指定で isError を返す', async () => {
    const result = await mock.getHandler('report_show')({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('いずれか一方');
  });

  it('report_show: id 指定で /api/v1/reports/:id を GET', async () => {
    await mock.getHandler('report_show')({ id: 1 });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports/1');
  });

  it('report_show: date 指定で /api/v1/reports/by_date を GET', async () => {
    await mock.getHandler('report_show')({ date: '2026-04-01' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports/by_date?date=2026-04-01');
  });
});

describe('Goal Tools', () => {
  let apiClient: ApiClient;
  let mock: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    apiClient = createApiClientMock();
    mock = createMockServer();
    registerGoalTools(mock.server, apiClient);
  });

  it('goal_create: /api/v1/weekly_goals に POST', async () => {
    await mock.getHandler('goal_create')({
      items: [{ content: '目標1' }],
      week_start: '2026-04-01',
    });
    const [path, body] = (apiClient.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe('/api/v1/weekly_goals');
    expect(body.items[0].content).toBe('目標1');
  });

  it('goal_current: /api/v1/weekly_goals/current を GET', async () => {
    await mock.getHandler('goal_current')({});
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/weekly_goals/current');
  });

  it('goal_list: limit をクエリに含める', async () => {
    await mock.getHandler('goal_list')({ limit: 20 });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/weekly_goals?limit=20');
  });

  it('goal_list: 引数なしでも動く', async () => {
    await mock.getHandler('goal_list')({});
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/weekly_goals');
  });

  it('goal_update: /api/v1/weekly_goals/:id に PATCH（idはbody外）', async () => {
    await mock.getHandler('goal_update')({ id: 9, items: [{ id: 1, progress: 50 }] });
    const [path, body] = (apiClient.patch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe('/api/v1/weekly_goals/9');
    expect(body).toEqual({ items: [{ id: 1, progress: 50 }] });
  });
});

describe('Plan Tools', () => {
  let apiClient: ApiClient;
  let mock: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    apiClient = createApiClientMock();
    mock = createMockServer();
    registerPlanTools(mock.server, apiClient);
  });

  it('plan_setup: /api/v1/plan/setup に POST', async () => {
    await mock.getHandler('plan_setup')({
      categories: [{ name: 'Ruby', estimated_hours: 10 }],
    });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/plan/setup', {
      categories: [{ name: 'Ruby', estimated_hours: 10 }],
    });
  });

  it('plan_show: /api/v1/plan を GET', async () => {
    await mock.getHandler('plan_show')({});
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/plan');
  });

  it('plan_add_category: /api/v1/plan/categories に POST', async () => {
    await mock.getHandler('plan_add_category')({ name: 'Rails', estimated_hours: 20 });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/plan/categories', {
      name: 'Rails',
      estimated_hours: 20,
    });
  });
});

describe('Student Tools', () => {
  let apiClient: ApiClient;
  let mock: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    apiClient = createApiClientMock();
    mock = createMockServer();
    registerStudentTools(mock.server, apiClient);
  });

  it('student_list: /api/v1/instructor/students をクエリ付きで GET', async () => {
    await mock.getHandler('student_list')({ status: 'inactive', team_id: 3 });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/instructor/students?status=inactive&team_id=3'
    );
  });

  it('student_list: 引数なしでも動く', async () => {
    await mock.getHandler('student_list')({});
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/instructor/students');
  });

  it('student_show: /api/v1/instructor/students/:id を GET', async () => {
    await mock.getHandler('student_show')({ id: 11 });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/instructor/students/11');
  });

  it('student_reports: ネストURLとmonth/limit クエリ', async () => {
    await mock.getHandler('student_reports')({ student_id: 5, month: '2026-04', limit: 10 });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/instructor/students/5/reports?month=2026-04&limit=10'
    );
  });

  it('student_report_show: ネストURLでレポート詳細', async () => {
    await mock.getHandler('student_report_show')({ student_id: 5, report_id: 42 });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/instructor/students/5/reports/42'
    );
  });
});

describe('Daily Goal Tools', () => {
  let apiClient: ApiClient;
  let mock: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    apiClient = createApiClientMock();
    mock = createMockServer();
    registerDailyGoalTools(mock.server, apiClient);
  });

  it('daily_show: /api/v1/daily_goals?date=... を GET', async () => {
    await mock.getHandler('daily_show')({ date: '2026-04-01' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/daily_goals?date=2026-04-01');
  });

  it('daily_list: /api/v1/daily_goals?week=... を GET', async () => {
    await mock.getHandler('daily_list')({ week: '2026-04-01' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/daily_goals?week=2026-04-01');
  });

  it('daily_update: ネストURL PATCH', async () => {
    await mock.getHandler('daily_update')({ daily_goal_id: 3, item_id: 7, content: '更新' });
    const [path, body] = (apiClient.patch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe('/api/v1/daily_goals/3/items/7');
    expect(body).toEqual({ content: '更新' });
  });
});

describe('Comment Tools', () => {
  let apiClient: ApiClient;
  let mock: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    apiClient = createApiClientMock();
    mock = createMockServer();
    registerCommentTools(mock.server, apiClient);
  });

  it('comment_list: /api/v1/comments?report_id=... を GET', async () => {
    await mock.getHandler('comment_list')({ report_id: 10 });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/comments?report_id=10');
  });

  it('comment_create: /api/v1/comments に POST', async () => {
    await mock.getHandler('comment_create')({ report_id: 10, content: 'よい' });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/comments', {
      report_id: 10,
      content: 'よい',
    });
  });

  it('comment_delete: /api/v1/comments/:id に DELETE', async () => {
    await mock.getHandler('comment_delete')({ id: 33 });
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/comments/33');
  });
});

describe('Dashboard Tools', () => {
  let apiClient: ApiClient;
  let mock: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    apiClient = createApiClientMock();
    mock = createMockServer();
    registerDashboardTools(mock.server, apiClient);
  });

  it('dashboard_daily: クエリパラメータ全て', async () => {
    await mock.getHandler('dashboard_daily')({
      date: '2026-04-01',
      team_id: 2,
      status: 'red',
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/instructor/dashboard/daily?date=2026-04-01&team_id=2&status=red'
    );
  });

  it('dashboard_daily: 引数なしでも動く', async () => {
    await mock.getHandler('dashboard_daily')({});
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/instructor/dashboard/daily');
  });
});
