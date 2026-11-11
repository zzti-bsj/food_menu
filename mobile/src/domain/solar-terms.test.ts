/** 节气领域逻辑测试:当前推算 / ±2 循环 / 季节归属 / 热量解析。 */
import { SEASON_TERMS, currentTerm, nearbyTerms, parseCalories, seasonOfTerm } from '@/domain/solar-terms';

describe('currentTerm', () => {
  it('立冬段:11月8日 → 立冬', () => {
    expect(currentTerm(new Date(2026, 10, 8))).toBe('立冬');
  });

  it('起始当天即切换:11月7日 → 立冬,11月6日 → 霜降', () => {
    expect(currentTerm(new Date(2026, 10, 7))).toBe('立冬');
    expect(currentTerm(new Date(2026, 10, 6))).toBe('霜降');
  });

  it('年初循环段:1月10日 → 小寒,2月3日 → 大寒', () => {
    expect(currentTerm(new Date(2026, 0, 10))).toBe('小寒');
    expect(currentTerm(new Date(2026, 1, 3))).toBe('大寒');
  });

  it('年中:6月21日 → 夏至', () => {
    expect(currentTerm(new Date(2026, 5, 21))).toBe('夏至');
  });
});

describe('nearbyTerms', () => {
  // 口径同 llm/recommend.py:中心前二 + 中心 + 后二
  it('中间位置:立冬 → 寒露/霜降/立冬/小雪/大雪', () => {
    expect(nearbyTerms('立冬')).toEqual(['寒露', '霜降', '立冬', '小雪', '大雪']);
  });

  it('跨大寒、立春循环:小寒 → 大雪/冬至/小寒/大寒/立春', () => {
    expect(nearbyTerms('小寒')).toEqual(['大雪', '冬至', '小寒', '大寒', '立春']);
  });

  it('立春:小寒/大寒/立春/雨水/惊蛰', () => {
    expect(nearbyTerms('立春')).toEqual(['小寒', '大寒', '立春', '雨水', '惊蛰']);
  });
});

describe('seasonOfTerm', () => {
  it('按每季 6 个划分', () => {
    expect(seasonOfTerm('立春')).toBe('spring');
    expect(seasonOfTerm('谷雨')).toBe('spring');
    expect(seasonOfTerm('立夏')).toBe('summer');
    expect(seasonOfTerm('大暑')).toBe('summer');
    expect(seasonOfTerm('立秋')).toBe('autumn');
    expect(seasonOfTerm('霜降')).toBe('autumn');
    expect(seasonOfTerm('立冬')).toBe('winter');
    expect(seasonOfTerm('大寒')).toBe('winter');
  });

  it('未知节气回退 winter', () => {
    expect(seasonOfTerm('不存在')).toBe('winter');
  });
});

describe('parseCalories', () => {
  it('解析「约350千卡」为数字', () => {
    expect(parseCalories('约350千卡')).toBe(350);
  });

  it('无数字返回 null', () => {
    expect(parseCalories('约一份')).toBeNull();
  });
});

describe('SEASON_TERMS', () => {
  it('四季各 6 个且并集为 24', () => {
    const all = Object.values(SEASON_TERMS).flat();
    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
  });
});
