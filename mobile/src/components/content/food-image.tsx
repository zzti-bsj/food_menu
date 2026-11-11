/** 内容图片:有 URL 用 expo-image;否则落默认占位图(§6)。声明宽高防 CLS(§3)。 */
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { DefaultImage, type PlaceholderKind } from '@/components/brand';
import { radius } from '@/theme/theme';

export interface FoodImageProps {
  uri: string | null;
  kind: PlaceholderKind;
  width: number;
  height: number;
}

export function FoodImage({ uri, kind, width, height }: FoodImageProps) {
  if (!uri) {
    return (
      <View style={[statics.wrap, { width, height }]}>
        <DefaultImage kind={kind} size={Math.min(width, height) * 0.5} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius: radius.m }}
      contentFit="cover"
      accessibilityLabel="内容图片"
    />
  );
}

const statics = StyleSheet.create({
  wrap: {
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
