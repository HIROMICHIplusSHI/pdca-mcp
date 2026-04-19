import type { ApiClient } from '../client/api-client.js';
import type { DailyGoal, DailyGoalItem } from '../types/api-types.js';

/**
 * レポートの learning_plan を該当日の日次目標アイテムに同期する。
 *
 * 背景: アプリUIの「Plan」欄は report.learning_plan ではなく daily_goals.items[].content
 * を参照している。goal_create 時に自動生成される "N%まで進める" を learning_plan の
 * 自由記述で上書きするためのヘルパー。
 *
 * 制約:
 * - learning_plan が空/nullなら何もしない
 * - 日次目標が存在しない/取得失敗時は静かに終了（レポート本体の成否を阻害しない）
 * - learning_plan を改行で分割し、items を position 昇順で 1:1 マッピング
 * - 行数不足は余った items をそのまま残し、行数超過は余った行を無視
 * - 個別 PATCH 失敗は他 item の処理を阻害しない
 */
export async function syncDailyGoalForDate(
  apiClient: ApiClient,
  date: string,
  learningPlan: string | null | undefined
): Promise<void> {
  if (!learningPlan) return;

  let dailyGoal: DailyGoal | undefined;
  try {
    const queryParams = new URLSearchParams({ date });
    const response = await apiClient.get<{ daily_goals: DailyGoal[] }>(
      `/api/v1/daily_goals?${queryParams}`
    );
    dailyGoal = response?.daily_goals?.[0];
  } catch (e) {
    console.error('[sync-daily-goal] 日次目標取得に失敗:', e);
    return;
  }

  if (!dailyGoal || !dailyGoal.items?.length) return;

  const goalId = dailyGoal.id;
  // 末尾改行は無視（ユーザーが末尾改行付きで送ると2行目のitemが空文字で上書きされるのを防ぐ）
  const lines = learningPlan.replace(/\n+$/, '').split(/\r?\n/);
  const sortedItems = [...dailyGoal.items].sort(
    (a, b) => a.position - b.position
  );
  const pairs = sortedItems
    .slice(0, lines.length)
    .map((item, idx) => ({ item, content: lines[idx] }));

  await Promise.all(
    pairs.map(({ item, content }) => updateItemSafely(apiClient, goalId, item, content))
  );
}

async function updateItemSafely(
  apiClient: ApiClient,
  dailyGoalId: number,
  item: DailyGoalItem,
  content: string
): Promise<void> {
  try {
    await apiClient.patch<{ item: DailyGoalItem }>(
      `/api/v1/daily_goals/${dailyGoalId}/items/${item.id}`,
      { content }
    );
  } catch (e) {
    // 個別失敗は無視（同期はベストエフォート）だが運用追跡のため stderr に残す
    console.error(
      `[sync-daily-goal] item ${item.id} (daily_goal ${dailyGoalId}) の更新に失敗:`,
      e
    );
  }
}
