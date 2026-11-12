/** 主按钮(§7):高 48 · radius 15 · 渐变 + 白字 + 同色投影;一屏一个。
 *  异步提交期 disabled + loading 文案(§2 loading-buttons)。
 *  工坊各功能可传 from/to 覆盖渐变(季色/厨师色);琥珀系浅底需配 labelColor 墨字保对比。 */
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { seasons, activeSeason } from '@/theme/tokens';
import { radius, type } from '@/theme/theme';

const accent = seasons[activeSeason];

export interface PrimaryButtonProps {
  label: string;
  /** 异步进行中:禁用并展示 loadingLabel */
  loading?: boolean;
  loadingLabel?: string;
  onPress: () => void;
  /** 覆盖渐变起点/终点(默认 accent.main → accent.deep) */
  from?: string;
  to?: string;
  /** 同色投影色(默认 accent.deep) */
  shadowColor?: string;
  /** 文字色(默认白;浅琥珀等浅底渐变传墨棕字保 ≥4.5:1) */
  labelColor?: string;
}

export function PrimaryButton({
  label,
  loading = false,
  loadingLabel,
  onPress,
  from = accent.main,
  to = accent.deep,
  shadowColor = accent.deep,
  labelColor = '#FFFFFF',
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      onPress={loading ? undefined : onPress}
      style={({ pressed }) => [
        statics.press,
        { shadowColor },
        pressed && !loading && statics.pressed,
      ]}
      disabled={loading}
    >
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={statics.box}>
        {/* 顶部白色低透明高光:给渐变加体积感(同 PanelPop 手法) */}
        <View style={statics.gloss} aria-hidden />
        <Text style={[statics.label, { color: labelColor }]}>
          {loading ? (loadingLabel ?? `${label}中…`) : label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const statics = StyleSheet.create({
  press: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 4,
  },
  pressed: {
    opacity: 0.88,
  },
  box: {
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  label: {
    ...type.bodyStrong,
    letterSpacing: 1,
  },
});
