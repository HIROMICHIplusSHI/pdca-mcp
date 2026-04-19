import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncReportLearningPlanForWeek } from '../../src/utils/sync-report-learning-plan.js';
import type { ApiClient } from '../../src/client/api-client.js';
import { ApiError } from '../../src/client/api-client.js';

describe('syncReportLearningPlanForWeek', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    apiClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as ApiClient;
  });

  it('週範囲が未指定ならapiClientを呼ばない', async () => {
    await syncReportLearningPlanForWeek(apiClient, '', '2026-04-24');
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('日次目標のcontentsをreport.learning_planへ反映する', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>)
      // /api/v1/daily_goals?date=2026-04-18
      .mockResolvedValueOnce({
        daily_goals: [{
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 1,
          items: [
            { id: 11, content: 'MCP実装', progress: 0, position: 0 },
          ],
        }],
      })
      // /api/v1/reports/by_date?date=2026-04-18
      .mockResolvedValueOnce({
        report: {
          id: 1001,
          report_date: '2026-04-18',
          learning_plan: '14%まで進める',
        },
      });

    await syncReportLearningPlanForWeek(apiClient, '2026-04-18', '2026-04-18');

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/reports/1001',
      { report: { learning_plan: 'MCP実装' } }
    );
  });

  it('複数itemは改行連結、position昇順', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        daily_goals: [{
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 1,
          items: [
            { id: 12, content: '目標B', progress: 0, position: 1 },
            { id: 11, content: '目標A', progress: 0, position: 0 },
          ],
        }],
      })
      .mockResolvedValueOnce({
        report: { id: 1001, report_date: '2026-04-18', learning_plan: '' },
      });

    await syncReportLearningPlanForWeek(apiClient, '2026-04-18', '2026-04-18');

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/reports/1001',
      { report: { learning_plan: '目標A\n目標B' } }
    );
  });

  it('report.learning_planが既に期待値と同じなら更新しない', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        daily_goals: [{
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 1,
          items: [{ id: 11, content: 'MCP実装', progress: 0, position: 0 }],
        }],
      })
      .mockResolvedValueOnce({
        report: {
          id: 1001,
          report_date: '2026-04-18',
          learning_plan: 'MCP実装',
        },
      });

    await syncReportLearningPlanForWeek(apiClient, '2026-04-18', '2026-04-18');

    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('daily_goalが無い日はスキップ', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ daily_goals: [] });

    await syncReportLearningPlanForWeek(apiClient, '2026-04-18', '2026-04-18');

    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('reportが無い日はスキップ', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        daily_goals: [{
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 1,
          items: [{ id: 11, content: 'MCP実装', progress: 0, position: 0 }],
        }],
      })
      .mockResolvedValueOnce({ report: null });

    await syncReportLearningPlanForWeek(apiClient, '2026-04-18', '2026-04-18');

    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('items全て空contentなら更新しない', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        daily_goals: [{
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 1,
          items: [{ id: 11, content: '', progress: 0, position: 0 }],
        }],
      });

    await syncReportLearningPlanForWeek(apiClient, '2026-04-18', '2026-04-18');

    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('範囲が複数日ならすべての日を処理', async () => {
    const get = apiClient.get as ReturnType<typeof vi.fn>;
    // 4/18: 日次あり→report存在→更新あり
    get.mockResolvedValueOnce({
      daily_goals: [{ id: 100, goal_date: '2026-04-18', weekly_goal_id: 1,
        items: [{ id: 11, content: 'A', progress: 0, position: 0 }] }],
    });
    get.mockResolvedValueOnce({
      report: { id: 1001, report_date: '2026-04-18', learning_plan: 'old' },
    });
    // 4/19: 日次なし
    get.mockResolvedValueOnce({ daily_goals: [] });
    // 4/20: 日次あり→report無し
    get.mockResolvedValueOnce({
      daily_goals: [{ id: 102, goal_date: '2026-04-20', weekly_goal_id: 1,
        items: [{ id: 13, content: 'B', progress: 0, position: 0 }] }],
    });
    get.mockResolvedValueOnce({ report: null });

    await syncReportLearningPlanForWeek(apiClient, '2026-04-18', '2026-04-20');

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/reports/1001',
      { report: { learning_plan: 'A' } }
    );
  });

  it('個別 GET/PATCH 失敗でも他日の処理は継続する', async () => {
    const get = apiClient.get as ReturnType<typeof vi.fn>;
    // 4/18: GET成功→PATCH失敗
    get.mockResolvedValueOnce({
      daily_goals: [{ id: 100, goal_date: '2026-04-18', weekly_goal_id: 1,
        items: [{ id: 11, content: 'A', progress: 0, position: 0 }] }],
    });
    get.mockResolvedValueOnce({
      report: { id: 1001, report_date: '2026-04-18', learning_plan: 'old' },
    });
    // 4/19: daily_goals GETでエラー
    get.mockRejectedValueOnce(new ApiError('SERVER_ERROR', 500));
    // 4/20: 正常更新
    get.mockResolvedValueOnce({
      daily_goals: [{ id: 102, goal_date: '2026-04-20', weekly_goal_id: 1,
        items: [{ id: 13, content: 'C', progress: 0, position: 0 }] }],
    });
    get.mockResolvedValueOnce({
      report: { id: 1003, report_date: '2026-04-20', learning_plan: 'old3' },
    });

    (apiClient.patch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new ApiError('SERVER_ERROR', 500))
      .mockResolvedValueOnce({});

    await expect(
      syncReportLearningPlanForWeek(apiClient, '2026-04-18', '2026-04-20')
    ).resolves.toBeUndefined();

    expect(apiClient.patch).toHaveBeenCalledTimes(2);
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/reports/1003',
      { report: { learning_plan: 'C' } }
    );
  });

  it('開始日 > 終了日なら何もしない', async () => {
    await syncReportLearningPlanForWeek(apiClient, '2026-04-20', '2026-04-18');
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
