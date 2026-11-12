/** 封面图上传(编辑菜谱/食材):16:9 预览 + 相机角标(v1.2 语言,同头像角标)。
 *  点按 → 拍照/相册(Alert 系统动作表)→ POST /api/uploads → onChange(相对 URL);
 *  上传期半透明遮罩 + 指示器;失败 Toast 透传接口文案;无图态 = 默认占位图 + 虚线框。 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { CameraIcon } from '@/components/icons';
import { DefaultImage, type PlaceholderKind } from '@/components/brand';
import { uploadImage } from '@/api/content-api';
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

export interface ImagePickFieldProps {
  uri: string | null;
  kind: PlaceholderKind;
  /** 上传成功传相对 URL;移除传 null(保存时一并 PATCH) */
  onChange: (uri: string | null) => void;
}

export function ImagePickField({ uri, kind, onChange }: ImagePickFieldProps) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  async function pick(source: 'camera' | 'library') {
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
        ? await ImagePicker.launchCameraAsync(pickOptions)
        : await ImagePicker.launchImageLibraryAsync(pickOptions);
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const ext = EXT_OF_MIME[asset.mimeType ?? ''] ?? 'jpg';
    setUploading(true);
    try {
      const { url } = await uploadImage({
        uri: asset.uri,
        name: `cover.${ext}`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      onChange(url);
      toast.showToast('图片已上传,保存后生效');
    } catch (e) {
      toast.showToast(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }

  function press() {
    if (uploading) return;
    const options: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }> = [
      { text: '拍照', onPress: () => void pick('camera') },
      { text: '从相册选择', onPress: () => void pick('library') },
    ];
    if (uri) {
      options.push({ text: '移除图片', style: 'destructive', onPress: () => onChange(null) });
    }
    options.push({ text: '取消', style: 'cancel' });
    Alert.alert('封面图片', undefined, options);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={uri ? '更换封面图片' : '上传封面图片'}
      onPress={press}
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
      {/* 相机角标:墨底白图标 + 白描边(同头像更换角标) */}
      <View style={statics.cam} aria-hidden>
        <CameraIcon size={13} color={colors.surface} />
      </View>
      {uploading && (
        <View style={statics.mask}>
          <ActivityIndicator color={colors.surface} />
        </View>
      )}
    </Pressable>
  );
}

const pickOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.8,
  exif: false,
};

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
  cam: {
    position: 'absolute',
    right: spacing.s3,
    bottom: spacing.s3,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
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
});
