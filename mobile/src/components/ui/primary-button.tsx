/** 主按钮(§7):高 48 · radius 15 · accent→accent-deep 渐变 + 白字 + 同色投影;一屏一个。
 *  异步提交期 disabled + loading 文案(§2 loading-buttons)。 */
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
}

export function PrimaryButton({ label, loading = false, loadingLabel, onPress }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      onPress={loading ? undefined : onPress}
      style={({ pressed }) => [statics.press, pressed && !loading && statics.pressed]}
      disabled={loading}
    >
      <LinearGradient
        colors={[accent.main, accent.deep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={statics.box}
      >
        <Text style={statics.label}>{loading ? (loadingLabel ?? `${label}中…`) : label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const statics = StyleSheet.create({
  press: {
    shadowColor: accent.deep,
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
  },
  label: {
    ...type.bodyStrong,
    color: '#FFFFFF',
  },
});
