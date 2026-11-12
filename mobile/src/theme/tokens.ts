/**
 * 设计语义 Token —— DESIGN-SYSTEM.md §2(色彩)的唯一代码翻译源。
 *
 * 规则:组件代码禁止出现裸 hex,一律引用本文件;
 * 设计稿数值变更时先改 DESIGN-SYSTEM.md,再同步此处。
 */

/** 中性层(亮纸 × 墨)§2.1 */
export const colors = {
  bg: '#FAF6ED', // 页面底(明快暖纸)
  surface: '#FFFFFF', // 卡片/浮层
  surface2: '#FBF8F1', // 次级面
  ink: '#26231C', // 主文字/主图标(对 bg ≈ 13.7:1)
  ink2: '#5B564A', // 次级文字(对 bg ≈ 6.4:1)
  ink3: '#6E6858', // 辅助文字(≥13px,对 bg ≈ 4.9:1)
  line: '#EAE4D6', // 分隔线/卡片描边
  lineStrong: '#DAD3C0', // 强分隔/输入框描边
  /** 舞台渐变第二停靠点(design/shike-app ingredients.html .stage,160deg 与 surface2 组合) */
  paperTint: '#F3EFE3',
} as const;

/** 品牌点睛色 §2.3 */
export const brand = {
  seal: '#B03A2E', // 朱砂/印泥红(白字 6.0:1)
  sealLight: '#CC4A3C', // 印章渐变起点
  amber: '#E8912A', // 活力琥珀(贴纸渐变、星光、热量环辅助)
  calorieArc: '#C25E2A', // 热量环弧(白托盘上 4.3:1,图形用)
} as const;

/** 功能色 §2.4 */
export const functional = {
  success: '#3D7A50',
  warning: '#8F5613',
  warningSoft: '#F7EFE2',
  danger: '#AE4436',
  dangerSoft: '#F7E8E5',
  /** 删除操作胶囊描边(danger 45%,my-content.html .op.del color-mix) */
  dangerLine: 'rgba(174,68,54,0.45)',
} as const;

/** 四季 §2.2:主色(白字填充)· 深档(渐变深字)· 淡底 · 粉彩面板渐变三停靠点 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonPalette {
  /** 主色,accent 指向它(填充/白字,≥4.5:1) */
  main: string;
  /** 深档(渐变深字) */
  deep: string;
  /** 淡底(季填充) */
  soft: string;
  /** 粉彩面板 .panel-pop 渐变(135deg 三停靠点,自 assets/theme.css 实测) */
  panel: [string, string, string];
}

export const seasons: Record<Season, SeasonPalette> = {
  spring: { main: '#2E8C55', deep: '#1F6B3E', soft: '#DFF2E6', panel: ['#E3F5EA', '#F0F7DF', '#FFF6E2'] },
  summer: { main: '#C14F32', deep: '#93391F', soft: '#FBE7DF', panel: ['#FBE7DF', '#FDF0DC', '#FFF6E2'] },
  autumn: { main: '#B7791A', deep: '#8A5D15', soft: '#FBF0DA', panel: ['#FBF0DA', '#FDEBDC', '#FFF6E2'] },
  winter: { main: '#35759F', deep: '#24586E', soft: '#E2F0FA', panel: ['#E4F1FB', '#DFF0E9', '#FFF6E2'] },
};

/**
 * 当前 accent 指向的季节。原型期 = 立冬(冬·青蓝);
 * 接入 `GET /api/terms` 当前节气后由运行时注入,此处仅为静态默认值。
 */
export const activeSeason: Season = 'winter';

/** 四气徽章 §2.5(功能信息,色 + 字双编码;键 = ingredient.nature 词表值) */
export const natureBadges: Record<string, { bg: string; fg: string }> = {
  寒: { bg: '#DCE9F5', fg: '#1F4670' },
  微寒: { bg: '#E4EFF7', fg: '#26507B' },
  凉: { bg: '#EAF1F8', fg: '#335D82' },
  平: { bg: '#ECEAE3', fg: '#524D41' },
  微温: { bg: '#F8EEDF', fg: '#7E4B12' },
  温: { bg: '#F8E9DB', fg: '#8C3F1B' },
  热: { bg: '#F8E6E0', fg: '#93301F' },
};

/** 五味不做彩色:中性描边 chip(--line-strong 描边 + --ink-2),见 ui 组件阶段实现 */
