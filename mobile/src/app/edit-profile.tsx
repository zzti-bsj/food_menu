/** 编辑资料(登录 push,对照 edit-profile.html):
 *  头像更换(字段规划中,接口待补 → 点按 Toast 说明)· 昵称 1-50 字(PATCH me,计数器 +
 *  失焦校验,错误文案逐字对齐)· 手机号/角色只读。 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Seal } from '@/components/brand';
import { CameraIcon } from '@/components/icons';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/api/client';
import { updateMe } from '@/api/auth-api';
import { useAuth } from '@/auth/auth-context';
import { brand, colors, functional } from '@/theme/tokens';
import { pagePad, radius, spacing, type } from '@/theme/theme';

const NICKNAME_MAX = 50;

export default function EditProfileScreen() {
  const { user, updateLocalUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <Centered text="请先登录后编辑资料" />
    );
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
          <Text style={[type.serifTitle, { color: colors.ink }]}>编辑资料</Text>
          <View style={statics.back} />
        </View>

        {/* 头像:字段规划中,接口待补(§10) */}
        <View style={statics.avatarRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="更换头像"
            onPress={() => toast.showToast('头像上传接口待补,敬请期待')}
            style={statics.avatarPress}
          >
            <Seal char={user.nickname?.[0] ?? '食'} />
            <View style={statics.avatarCam}>
              <CameraIcon color={colors.surface} />
            </View>
          </Pressable>
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
          <TextInput
            style={[statics.input, !!error && statics.inputError]}
            value={nickname}
            onChangeText={(v) => {
              setNickname(v);
              if (error) setError(null);
            }}
            onBlur={validate}
            placeholder="1-50 字"
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
          <PrimaryButton label="保存" loading={saving} onPress={save} />
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
  avatarCam: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
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
    ...type.body,
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
