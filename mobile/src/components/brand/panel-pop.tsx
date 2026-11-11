/** 粉彩面板 §2.6/§6:季粉彩渐变(135deg 三停靠)+ 白描边 + 卡片投影的明底面板。
 *  面板文字一律墨字/季深档字(对比 4.8-14.6:1),由使用方注入内容。
 *  iOS 端近似 CSS 的右上径向高光(radial-gradient):RN 无径向渐变,用白色低透明圆叠层。 */
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { seasons, type Season } from '@/theme/tokens';
import { radius, shadows } from '@/theme/theme';

export interface PanelPopProps {
  season?: Season;
  /** 面板内容(墨字体系) */
  children: ReactNode;
  /** 是否叠右上白色高光(默认开,winter 稿面可见) */
  highlight?: boolean;
}

export function PanelPop({ season = 'winter', children, highlight = true }: PanelPopProps) {
  return (
    <View style={[statics.wrap, shadows.card.android]}>
      <LinearGradient
        colors={seasons[season].panel}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[statics.panel, shadows.card.ios]}
      >
        {highlight && <View style={statics.highlight} />}
        {children}
      </LinearGradient>
    </View>
  );
}

const statics = StyleSheet.create({
  wrap: {
    borderRadius: radius.m,
    overflow: 'hidden',
  },
  panel: {
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  // 右上 88% 0% 处 240×160 白光 .75-.8 → 置于右上角的半透明椭圆
  highlight: {
    position: 'absolute',
    top: -60,
    right: -70,
    width: 240,
    height: 160,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
});
