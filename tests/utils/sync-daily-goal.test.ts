import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncDailyGoalForDate } from '../../src/utils/sync-daily-goal.js';
import type { ApiClient } from '../../src/client/api-client.js';
import { ApiError } from '../../src/client/api-client.js';

describe('syncDailyGoalForDate', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    apiClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as ApiClient;
  });

  it('learning_planが空ならapiClientを呼ばない', async () => {
    await syncDailyGoalForDate(apiClient, '2026-04-18', '');
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('learning_planがnullならapiClientを呼ばない', async () => {
    await syncDailyGoalForDate(apiClient, '2026-04-18', null);
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('日次目標が存在する場合、1行1itemでcontentを更新する', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      daily_goals: [
        {
          id: 1642,
          goal_date: '2026-04-18',
          weekly_goal_id: 246,
          items: [
            { id: 3760, content: '14%まで進める', progress: 0, position: 0 },
          ],
        },
      ],
    });

    await syncDailyGoalForDate(apiClient, '2026-04-18', 'MCP実装');

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/daily_goals/1642/items/3760',
      { content: 'MCP実装' }
    );
  });

  it('複数行の場合、position順にitemsへ1:1マッピング', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      daily_goals: [
        {
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 10,
          items: [
            { id: 11, content: '旧1', progress: 0, position: 0 },
            { id: 12, content: '旧2', progress: 0, position: 1 },
          ],
        },
      ],
    });

    await syncDailyGoalForDate(apiClient, '2026-04-18', '新1\n新2');

    expect(apiClient.patch).toHaveBeenCalledTimes(2);
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/daily_goals/100/items/11',
      { content: '新1' }
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/daily_goals/100/items/12',
      { content: '新2' }
    );
  });

  it('行数 < items数なら余ったitemは更新しない', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      daily_goals: [
        {
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 10,
          items: [
            { id: 11, content: '旧1', progress: 0, position: 0 },
            { id: 12, content: '旧2', progress: 0, position: 1 },
          ],
        },
      ],
    });

    await syncDailyGoalForDate(apiClient, '2026-04-18', '新1のみ');

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/daily_goals/100/items/11',
      { content: '新1のみ' }
    );
  });

  it('行数 > items数なら余った行は無視', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      daily_goals: [
        {
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 10,
          items: [{ id: 11, content: '旧1', progress: 0, position: 0 }],
        },
      ],
    });

    await syncDailyGoalForDate(apiClient, '2026-04-18', '新1\n新2\n新3');

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/daily_goals/100/items/11',
      { content: '新1' }
    );
  });

  it('日次目標が存在しない場合、何もしない', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      daily_goals: [],
    });

    await syncDailyGoalForDate(apiClient, '2026-04-18', 'MCP実装');

    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('GET失敗時にexceptionをthrowせず静かに終了する', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError('NOT_FOUND', 404)
    );

    await expect(
      syncDailyGoalForDate(apiClient, '2026-04-18', 'MCP実装')
    ).resolves.toBeUndefined();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('PATCH失敗時もexceptionをthrowしない', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      daily_goals: [
        {
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 10,
          items: [
            { id: 11, content: '旧1', progress: 0, position: 0 },
            { id: 12, content: '旧2', progress: 0, position: 1 },
          ],
        },
      ],
    });
    (apiClient.patch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ item: { id: 11, content: '新1', progress: 0, position: 0 } })
      .mockRejectedValueOnce(new ApiError('SERVER_ERROR', 500));

    await expect(
      syncDailyGoalForDate(apiClient, '2026-04-18', '新1\n新2')
    ).resolves.toBeUndefined();
  });

  it('positionが昇順でない場合もposition昇順で処理する', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      daily_goals: [
        {
          id: 100,
          goal_date: '2026-04-18',
          weekly_goal_id: 10,
          items: [
            { id: 12, content: '旧2', progress: 0, position: 1 },
            { id: 11, content: '旧1', progress: 0, position: 0 },
          ],
        },
      ],
    });

    await syncDailyGoalForDate(apiClient, '2026-04-18', '新1\n新2');

    expect(apiClient.patch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/daily_goals/100/items/11',
      { content: '新1' }
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/daily_goals/100/items/12',
      { content: '新2' }
    );
  });
});
