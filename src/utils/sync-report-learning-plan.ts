import type { ApiClient } from '../client/api-client.js';
import type { DailyGoal, Report } from '../types/api-types.js';

/**
 * 指定週の各日について、`daily_goal_items[].content` を `report.learning_plan` に反映する。
 *
 * 背景: `goal_update` 実行後、バックエンド側の pdca_reports_controller が
 * `learning_plan = daily_goal_items.first.content` で上書きするケースがある。
 * MCP/CLI 等のAPIクライアントが `report.learning_plan` を信頼する運用のため、
 * goal_update 後に改めて daily_goal_items→learning_plan の再同期を行う。
 *
 * ⚠️ 方向の対称性:
 * - 本ヘルパー: `daily_goal_items → report.learning_plan`（goal_update 起点）
 * - sync-daily-goal.ts: `report.learning_plan → daily_goal_items`（report_create/update 起点）
 *
 * どちらも該当ツール成功時のみ発動するため、単発ツール呼び出しでは衝突しない。
 * 連続呼び出し時は「最後に叩いたツールの入力が勝つ」挙動となる。
 * なお koki-kato/pdca-app#93（自動テンプレート廃止）が成立すれば
 * 本ヘルパーは不要化できる見込み。
 *
 * 仕様:
 * - weekStart/weekEnd どちらか未指定なら no-op
 * - 開始日 > 終了日なら no-op
 * - 各日について daily_goals の GET、report の by_date GET、必要なら report の PATCH
 * - daily_goal/items/report の欠落は silent skip
 * - 個別日の失敗は他日の処理を阻害しない（ベストエフォート）
 * - 現在の learning_plan と join 後の内容が一致していれば PATCH しない（無駄呼び防止）
 */
export async function syncReportLearningPlanForWeek(
  apiClient: ApiClient,
  weekStart: string,
  weekEnd: string
): Promise<void> {
  if (!weekStart || !weekEnd) return;

  const dates = enumerateDates(weekStart, weekEnd);
  if (dates.length === 0) return;

  // 順次処理: テスト容易性とエラー局所化のため並列化しない（週7日程度なら実用上問題なし）
  const startedAt = Date.now();
  for (const date of dates) {
    await syncOneDay(apiClient, date);
  }
  const elapsedMs = Date.now() - startedAt;
  console.error(
    `[sync-report-learning-plan] ${dates.length}日分の同期完了 (${elapsedMs}ms)`
  );
}

async function syncOneDay(apiClient: ApiClient, date: string): Promise<void> {
  let dailyGoal: DailyGoal | undefined;
  try {
    const dailyParams = new URLSearchParams({ date });
    const dailyRes = await apiClient.get<{ daily_goals: DailyGoal[] }>(
      `/api/v1/daily_goals?${dailyParams}`
    );
    dailyGoal = dailyRes?.daily_goals?.[0];
  } catch (e) {
    console.error(`[sync-report-learning-plan] daily_goals GET失敗 (${date}):`, e);
    return;
  }

  if (!dailyGoal || !dailyGoal.items?.length) return;

  const sorted = [...dailyGoal.items].sort((a, b) => a.position - b.position);
  const contents = sorted.map((i) => i.content ?? '');
  // 全item空の場合はスキップ（既存の learning_plan を空文字で上書きしないための防御）
  const allBlank = contents.every((c) => c === '');
  if (allBlank) return;

  const joined = contents.join('\n');

  let report: Report | null | undefined;
  try {
    const reportParams = new URLSearchParams({ date });
    const reportRes = await apiClient.get<{ report: Report | null }>(
      `/api/v1/reports/by_date?${reportParams}`
    );
    report = reportRes?.report;
  } catch (e) {
    console.error(`[sync-report-learning-plan] report GET失敗 (${date}):`, e);
    return;
  }

  if (!report) return;
  if (report.learning_plan === joined) return;

  try {
    await apiClient.patch<{ report: Report }>(
      `/api/v1/reports/${report.id}`,
      { report: { learning_plan: joined } }
    );
  } catch (e) {
    console.error(
      `[sync-report-learning-plan] report PATCH失敗 (report_id=${report.id}, date=${date}):`,
      e
    );
  }
}

function enumerateDates(start: string, end: string): string[] {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return [];
  if (s > e) return [];
  const out: string[] = [];
  const cur = new Date(s);
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
