/**
 * 节气领域逻辑:当前节气推算 / ±2 当令口径 / 季节归属。
 * ±2 算法对齐 llm/recommend.py(`_nearby_terms`);当前节气为端内按近似日期推算
 * (每年实际日期 ±1 天,v1 可接受;后续可接后端计算口径)。
 */

/** 24 节气(序 = 词表序,立春起) */
export const TERMS = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
] as const;

export type Term = (typeof TERMS)[number];
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

/** 近似起始日期(M-D;误差 ±1 天) */
const TERM_DATES: readonly (readonly [number, number])[] = [
  [2, 4], [2, 19], [3, 6], [3, 21], [4, 5], [4, 20],
  [5, 6], [5, 21], [6, 6], [6, 21], [7, 7], [7, 23],
  [8, 8], [8, 23], [9, 8], [9, 23], [10, 8], [10, 23],
  [11, 7], [11, 22], [12, 7], [12, 22], [1, 6], [1, 20],
];

/** 每季 6 个节气(立春起顺序分) */
export const SEASON_TERMS: Record<SeasonKey, readonly Term[]> = {
  spring: TERMS.slice(0, 6),
  summer: TERMS.slice(6, 12),
  autumn: TERMS.slice(12, 18),
  winter: TERMS.slice(18, 24),
};

/** 节气 → 季节 */
export function seasonOfTerm(term: string): SeasonKey {
  const index = TERMS.indexOf(term as Term);
  if (index < 0) return 'winter';
  return (['spring', 'summer', 'autumn', 'winter'] as const)[Math.floor(index / 6)];
}

/** 月日 → 年内第几天(非闰年口径,节气起始误差 ±1 天,足够) */
function dayOfYear(month: number, day: number): number {
  const CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return CUMULATIVE[month - 1] + day;
}

/** 设备日期 → 当前节气:取起始「年内第几天」≤ 今天的最大者。
 *  用 dayOfYear 而非月序比较,避免年初循环段(小寒/大寒)覆盖正确答案。 */
export function currentTerm(date: Date = new Date()): Term {
  const today = dayOfYear(date.getMonth() + 1, date.getDate());
  let current: Term = '大寒'; // 早于小寒(1/6)时,处于上一个循环段末尾的大寒
  let latest = -1;
  for (let i = 0; i < TERMS.length; i++) {
    const [m, d] = TERM_DATES[i];
    const start = dayOfYear(m, d);
    if (start <= today && start > latest) {
      latest = start;
      current = TERMS[i];
    }
  }
  return current;
}

/** 当前节气及前后各两个,共 5 个;跨大寒、立春循环(口径同 llm/recommend.py) */
export function nearbyTerms(term: string): Term[] {
  const center = TERMS.indexOf(term as Term);
  if (center < 0) return [currentTerm()];
  return [0, 1, 2, 3, 4].map((i) => TERMS[(center + i - 2 + TERMS.length) % TERMS.length]);
}

/** 「约350千卡」→ 350;无数字返回 null(UI 隐藏热量环) */
export function parseCalories(text: string): number | null {
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}
