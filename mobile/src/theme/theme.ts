/**
 * 结构 Token —— DESIGN-SYSTEM.md §3(字体)/ §4(间距/圆角/阴影/层级)的代码翻译。
 *
 * 阴影映射说明:CSS 多层 box-shadow 在 RN iOS 上仅支持单层,
 * 取主层(偏移最大层)翻译;Android 用 elevation 视觉近似。
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/** §4 间距(4pt 基准) */
export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
} as const;

/** 页面左右边距 20px(§4) */
export const pagePad = 20;

/** §4 圆角 */
export const radius = {
  s: 10,
  m: 16,
  l: 24,
  dock: 26,
  seal: 8,
} as const;

/** RN 阴影(iOS 精确 + Android elevation 近似) */
export interface ShadowTier {
  ios: Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius'>;
  android: { elevation: number };
}

export const shadows: Record<'card' | 'lift' | 'float', ShadowTier> = {
  // --shadow-card: 0 1px 2px .05 + 0 6px 20px .08(取主层)
  card: {
    ios: { shadowColor: '#26231C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 20 },
    android: { elevation: 2 },
  },
  // --shadow-lift: 0 2px 6px .08 + 0 14px 34px .13(取主层)
  lift: {
    ios: { shadowColor: '#26231C', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.13, shadowRadius: 34 },
    android: { elevation: 6 },
  },
  // --shadow-float: 0 10px 40px .16
  float: {
    ios: { shadowColor: '#26231C', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 40 },
    android: { elevation: 10 },
  },
};

/** 平台衬线族:Android 无系统 CJK 衬线,先回退 serif;
 *  TODO(Phase 6): expo-font 打包 Noto Serif SC(§3),替换 Platform.select。 */
export const fontDisplay = Platform.select({
  ios: 'Songti SC',
  android: 'serif',
  default: 'Georgia',
}) as string;

export const fontBody = Platform.select({
  ios: 'PingFang SC',
  android: 'sans-serif',
  default: 'system-ui',
}) as string;

/** §3 字阶(衬线 = 展示角色;无衬线 = 正文角色) */
export const type = {
  /** 节气名/页面大标题 28/40 */
  display: { fontFamily: fontDisplay, fontSize: 28, lineHeight: 40, fontWeight: '700' } as TextStyle,
  /** 顶栏标题衬线 20(§7) */
  serifTitle: { fontFamily: fontDisplay, fontSize: 20, lineHeight: 28, fontWeight: '700' } as TextStyle,
  /** 节气 Hero 大字 66(§3) */
  hero: { fontFamily: fontDisplay, fontSize: 66, lineHeight: 76, fontWeight: '700' } as TextStyle,
  /** 正文强调/列表主文字 17/24 600 */
  bodyStrong: { fontFamily: fontBody, fontSize: 17, lineHeight: 24, fontWeight: '600' } as TextStyle,
  /** 正文 15/23 */
  body: { fontFamily: fontBody, fontSize: 15, lineHeight: 23, fontWeight: '400' } as TextStyle,
  /** 注脚/说明 13/18(下限 13px) */
  caption: { fontFamily: fontBody, fontSize: 13, lineHeight: 18, fontWeight: '400' } as TextStyle,
  /** 组标签 13/18 600 字距 1(§7,--ink-3) */
  sectionLabel: { fontFamily: fontBody, fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 1 } as TextStyle,
  /** Dock 导航标签 11/14 500(§7) */
  navLabel: { fontFamily: fontBody, fontSize: 11, lineHeight: 14, fontWeight: '500' } as TextStyle,
} as const;

/** 数字统一 tabular(§3:热量、分量、时间) */
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

/** 输入框文字基样式:禁止携带 lineHeight——Android 上「固定高 + 显式行高」会让文字在框内
 *  上下滚动(字体度量 > 内部可用高);垂直居中交给固定高 + textAlignVertical。
 *  paddingTop 6 = 视觉配重:CJK 字形在字体 em 框内偏上,按行框居中会显得偏高,下压补偿。 */
export const inputText: TextStyle = {
  fontSize: 15,
  fontWeight: '400',
  paddingTop: 6,
  paddingBottom: 0,
  textAlignVertical: 'center',
};

/** 多行输入:顶对齐、自带纵向内边距,高度用固定值 + overflow 截断 */
export const inputTextMultiline: TextStyle = {
  fontSize: 15,
  fontWeight: '400',
  paddingHorizontal: 14,
  paddingVertical: 12,
  textAlignVertical: 'top',
};

/** §4 z-index 层级 */
export const z = {
  content: 0,
  stickyHeader: 10,
  dock: 20,
  overlay: 40,
  toast: 100,
} as const;
