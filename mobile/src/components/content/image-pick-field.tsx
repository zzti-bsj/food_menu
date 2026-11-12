/** 封面图选择/上传(编辑菜谱/食材):16:9 预览 + 底部操作条(拍照 / 相册 / 移除)+ 辅助说明。
 *  上传走 POST /api/uploads;上传期半透明遮罩 + 指示器;失败 Toast(404 提示重启后端)。
 *  选择/上传逻辑抽为 useImagePick 供圆形头像(编辑资料)复用。 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { DefaultImage, type PlaceholderKind } from '@/components/brand';
import { uploadImage } from '@/api/content-api';
import { ApiError } from '@/api/client';
import { resolveImageUrl } from '@/components/content/food-image';
import { useToast } from '@/components/ui/toast';
import { colors } from '@/theme/tokens';
import { radius, spacing, type } from '@/theme/theme';

const EXT_OF_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.8,
  exif: false,
};

/**
 * 裁剪/相册输出的 uri 可能是 content:// 或应用沙盒外路径,RN FormData 读不了,
 * fetch 会在请求发出前就失败(服务端收不到任何东西)。统一复制进应用缓存目录,
 * 拿到确定的 file:// 路径再上传;复制失败退回原 uri(错误照常透出)。
 */
function toStableLocalUri(sourceUri: string, ext: string): string {
  if (Platform.OS === 'web') return sourceUri;
  try {
    const target = new File(Paths.cache, `upload-${Date.now()}.${ext}`);
    target.copySync(new File(sourceUri));
    if (!target.exists) return sourceUri;
    return target.uri;
  } catch {
    return sourceUri;
  }
}

/** 选图 + 上传(挂 Toast 提示);onUploaded 收到相对 URL(移除不在此处理,由调用方决定) */
export function useImagePick(onUploaded: (url: string) => void) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const pick = useCallback(
    async (source: 'camera' | 'library') => {
      const granted =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted.granted) {
        toast.showToast('需要相册/相机权限,请在系统设置中开启');
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(PICK_OPTIONS)
          : await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS);
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const ext = EXT_OF_MIME[asset.mimeType ?? ''] ?? 'jpg';
      setUploading(true);
      try {
        const { url } = await uploadImage({
          uri: toStableLocalUri(asset.uri, ext),
          name: `cover.${ext}`,
          mimeType: asset.mimeType ?? 'image/jpeg',
        });
        onUploaded(url);
        toast.showToast('图片已上传,保存后生效');
      } catch (e) {
        // 404 = 后端进程是旧版(新路由 /api/uploads 不存在),其余透传原文
        if (e instanceof ApiError && e.status === 404) {
          toast.showToast('上传接口不存在,请重启后端服务(web/app.py)后重试');
        } else {
          toast.showToast(e instanceof Error ? e.message : '上传失败');
        }
      } finally {
        setUploading(false);
      }
    },
    [onUploaded, toast],
  );

  /** 系统动作表:拍照 / 相册 / (可选)移除 / 取消 */
  const showActionSheet = useCallback(
    (hasImage: boolean, onRemove?: () => void) => {
      if (uploading) return;
      const options: Array<{
        text: string;
        onPress?: () => void;
        style?: 'default' | 'cancel' | 'destructive';
      }> = [
        { text: '拍照', onPress: () => void pick('camera') },
        { text: '从相册选择', onPress: () => void pick('library') },
      ];
      if (hasImage && onRemove) {
        options.push({ text: '移除图片', style: 'destructive', onPress: onRemove });
      }
      options.push({ text: '取消', style: 'cancel' });
      Alert.alert('封面图片', undefined, options);
    },
    [pick, uploading],
  );

  return { uploading, pick, showActionSheet };
}

export interface ImagePickFieldProps {
  uri: string | null;
  kind: PlaceholderKind;
  /** 上传成功传相对 URL;移除传 null(保存时一并 PATCH) */
  onChange: (uri: string | null) => void;
}

export function ImagePickField({ uri, kind, onChange }: ImagePickFieldProps) {
  const { uploading, pick, showActionSheet } = useImagePick((url) => onChange(url));

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? '更换封面图片' : '上传封面图片'}
        onPress={() => showActionSheet(!!uri, () => onChange(null))}
        style={statics.wrap}
      >
        {uri ? (
          <Image source={{ uri: resolveImageUrl(uri) }} style={statics.preview} contentFit="cover" />
        ) : (
          <View style={statics.empty}>
            <DefaultImage kind={kind} size={64} />
            <Text style={[type.caption, statics.hint]}>上传图片</Text>
          </View>
        )}
        {/* 上传中遮罩 */}
        {uploading && (
          <View style={statics.mask}>
            <ActivityIndicator color={colors.surface} />
          </View>
        )}
        {/* 底部操作条(有图时):拍照 / 相册 / 移除,白字压在渐隐黑条上 */}
        {uri && !uploading && (
          <View style={statics.actionBar}>
            <ActionChip label="拍照" onPress={() => pick('camera')} />
            <ActionChip label="相册" onPress={() => pick('library')} />
            <ActionChip label="移除" onPress={() => onChange(null)} danger />
          </View>
        )}
      </Pressable>
      <Text style={statics.helper}>支持 jpg / png / webp / gif,≤5MB;保存后生效</Text>
    </View>
  );
}

/** 预览上的迷你操作按钮(半透明墨底胶囊,白字) */
function ActionChip({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        statics.chip,
        danger && { backgroundColor: 'rgba(174,68,54,0.85)' },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={statics.chipText}>{label}</Text>
    </Pressable>
  );
}

const statics = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    aspectRatio: 16 / 9,
    borderRadius: radius.m,
    overflow: 'hidden',
  },
  preview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  empty: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderStyle: 'dashed',
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s2,
  },
  hint: {
    color: colors.ink3,
  },
  /** 底部渐隐黑条上的操作 chips */
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.s2,
    padding: spacing.s3,
    backgroundColor: 'rgba(38,35,28,0.35)',
  },
  chip: {
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  mask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(38,35,28,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: {
    ...type.caption,
    color: colors.ink3,
    marginTop: spacing.s2,
  },
});
