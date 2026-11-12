/** 内容图片:有 URL 用 expo-image;否则落默认占位图(§6)。声明宽高防 CLS(§3)。
 *  上传封面返回相对路径(/uploads/xx),此处统一拼 API_BASE_URL;完整 http(s) 原样使用。 */
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { DefaultImage, type PlaceholderKind } from '@/components/brand';
import { API_BASE_URL } from '@/api/config';
import { radius } from '@/theme/theme';

export function resolveImageUrl(uri: string): string {
  return /^https?:\/\//.test(uri) ? uri : `${API_BASE_URL}${uri}`;
}

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
      source={{ uri: resolveImageUrl(uri) }}
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
