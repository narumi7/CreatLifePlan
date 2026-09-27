export const MAN = 10_000;

/** 金額を「1,234万円」形式で表示 */
export function man(v: number, digits = 0): string {
  const x = v / MAN;
  return `${x.toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits })}万円`;
}

export function yen(v: number): string {
  return `${Math.round(v).toLocaleString('ja-JP')}円`;
}

export function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

/** グラフの軸用（単位: 万円） */
export function axisMan(v: number): string {
  return `${Math.round(v / MAN).toLocaleString('ja-JP')}`;
}
