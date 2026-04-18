// 日付ユーティリティ

/**
 * 今日のJST日付を YYYY-MM-DD 形式で返す。
 * `sv-SE` ロケール経由で ISO 8601（YYYY-MM-DD）形式を取得している。
 */
export function todayJST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}
