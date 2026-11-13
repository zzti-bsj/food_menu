/** 编辑资料(登录 push,对照 edit-profile.html):
 *  头像上传(圆形预览,拍照/相册/移除动作表,选择即上传并即时 PATCH me.avatar)·
 *  昵称 1-50 字(计数器 + 失焦校验,错误文案逐字对齐)· 手机号/角色只读。 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Seal } from '@/components/brand';
import { CameraIcon } from '@/components/icons';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { useImagePick } from '@/components/content/image-pick-field';
import { resolveImageUrl } from '@/components/content/food-image';
import { ApiError } from '@/api/client';
import { updateMe } from '@/api/auth-api';
import { useAuth } from '@/auth/auth-context';
import { brand, colors, functional } from '@/theme/tokens';
import { cursorProps, inputText, pagePad, radius, spacing, type } from '@/theme/theme';

const NICKNAME_MAX = 50;

export default function EditProfileScreen() {
  const { user, updateLocalUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // 头像即时保存(不进保存按钮):上传成功 → PATCH me.avatar → 同步本地用户
  const [avatarSaving, setAvatarSaving] = useState(false);

  useEffect(() => {
    if (user) setNickname(user.nickname ?? '');
  }, [user]);

  const onAvatarUploaded = useCallback(
    (url: string) => {
      setAvatarSaving(true);
      updateMe({ avatar: url })
        .then((updated) => {
          updateLocalUser(updated);
          toast.showToast('头像已更新');
        })
        .catch((e) => {
          toast.showToast(e instanceof ApiError ? e.message : '网络连接失败,请检查网络后重试');
        })
        .finally(() => setAvatarSaving(false));
    },
    [toast, updateLocalUser],
  );

  // hook 须在早退 return 之前调用;回调内部自行判空
  const { uploading, pick, showActionSheet } = useImagePick(onAvatarUploaded);

  function removeAvatar() {
    setAvatarSaving(true);
    updateMe({ avatar: null })
      .then((updated) => {
        updateLocalUser(updated);
        toast.showToast('头像已移除');
      })
      .catch((e) => {
        toast.showToast(e instanceof ApiError ? e.message : '网络连接失败,请检查网络后重试');
      })
      .finally(() => setAvatarSaving(false));
  }

  function pressAvatar() {
    if (!user || avatarSaving || uploading) return;
    showActionSheet(!!user.avatar, user.avatar ? removeAvatar : undefined);
  }

  if (!user) {
    return <Centered text="请先登录后编辑资料" />;
  }

  /** 失焦校验,文案逐字对齐后端(web/app.py auth_update_me) */
  function validate(): boolean {
    const trimmed = nickname.trim();
    if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX) {
      setError('nickname 须为1-50字');
      return false;
    }
    setError(null);
    return true;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const updated = await updateMe({ nickname: nickname.trim() });
      updateLocalUser(updated);
      toast.showToast('资料已更新');
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '网络连接失败,请检查网络后重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={statics.flex}>
      <ScrollView contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2 }]} keyboardShouldPersistTaps="handled">
        <View style={statics.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回"
            hitSlop={8}
            onPress={() => (router.canDismiss() ? router.back() : router.replace('/'))}
            style={statics.back}
          >
            <Text style={statics.backIcon}>‹</Text>
          </Pressable>
          <Text style={[type.serifTitle, { color: colors.ink }]} numberOfLines={1}>编辑资料</Text>
          <View style={statics.back} />
        </View>

        {/* 头像:圆形预览(无图回退昵称印章)+ 相机角标;点按 → 拍照/相册/移除,即时保存 */}
        <View style={statics.avatarRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={user.avatar ? '更换头像' : '上传头像'}
            onPress={pressAvatar}
            style={statics.avatarPress}
          >
            {user.avatar ? (
              <Image source={{ uri: resolveImageUrl(user.avatar) }} style={statics.avatarImg} contentFit="cover" />
            ) : (
              <View style={statics.avatarSealWrap}>
                <Seal char={user.nickname?.[0] ?? '食'} />
              </View>
            )}
            <View style={statics.avatarCam}>
              <CameraIcon color={colors.surface} />
            </View>
            {(uploading || avatarSaving) && (
              <View style={statics.avatarMask}>
                <ActivityIndicator color={colors.surface} />
              </View>
            )}
          </Pressable>
          <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s2 }]}>
            点按头像拍照或从相册更换
          </Text>
        </View>

        {/* 昵称 */}
        <View style={statics.field}>
          <View style={statics.labelRow}>
            <Text style={statics.label}>
              昵称 <Text style={statics.required}>*</Text>
            </Text>
            <Text style={[type.caption, { color: colors.ink3 }]}>
              {nickname.trim().length}/{NICKNAME_MAX}
            </Text>
          </View>
          <TextInput {...cursorProps}
            style={[statics.input, !!error && statics.inputError]}
            value={nickname}
            onChangeText={(v) => {
              setNickname(v);
              if (error) setError(null);
            }}
            onBlur={validate}
            placeholder="请输入昵称"
            placeholderTextColor={colors.ink3}
            maxLength={NICKNAME_MAX + 10}
            textContentType="nickname"
          />
          {!!error && (
            <Text accessibilityRole="alert" style={statics.error}>
              {error}
            </Text>
          )}
        </View>

        {/* 只读项 */}
        <View style={statics.readonlyRow}>
          <Text style={statics.readonlyKey}>手机号</Text>
          <Text style={statics.readonlyValue}>{user.phone}</Text>
        </View>
        <View style={[statics.readonlyRow, statics.readonlyLast]}>
          <Text style={statics.readonlyKey}>角色</Text>
          <Text style={statics.readonlyValue}>{user.role === 'admin' ? '管理员' : '用户'}</Text>
        </View>

        <View style={statics.submitWrap}>
          <PrimaryButton label="保存" loading={saving} onPress={() => void save()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <View style={statics.centered}>
      <Text style={[type.body, { color: colors.ink2 }]}>{text}</Text>
    </View>
  );
}

const statics = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    backgroundColor: colors.bg,
    paddingHorizontal: pagePad,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: spacing.s4,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 28,
    lineHeight: 34,
    color: colors.ink,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: spacing.s6,
  },
  avatarPress: {
    position: 'relative',
  },
  avatarSealWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.surface2,
  },
  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  avatarCam: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    backgroundColor: 'rgba(38,35,28,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    marginBottom: spacing.s5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink2,
    marginBottom: spacing.s2,
  },
  required: {
    color: brand.seal,
  },
  input: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    ...inputText,
    color: colors.ink,
  },
  inputError: {
    borderColor: functional.danger,
  },
  error: {
    ...type.caption,
    color: functional.danger,
    marginTop: spacing.s1,
  },
  readonlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  readonlyLast: {
    borderBottomWidth: 0,
  },
  readonlyKey: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink3,
  },
  readonlyValue: {
    ...type.body,
    color: colors.ink2,
  },
  submitWrap: {
    marginTop: spacing.s6,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: pagePad,
  },
});
