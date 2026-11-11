/** 登录 / 注册(对照 login.html 双 Tab)—— §1 表单规范:
 *  label 常显(必填 *)· 失焦校验 · 错误文案逐字对齐接口 · 密码可见切换 · helper 规则说明。 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { pagePad, radius, shadows, spacing, type } from '@/theme/theme';

const accent = seasons[activeSeason];
const PHONE_RE = /^1\d{10}$/;

type Mode = 'login' | 'register';
interface FieldErrors {
  phone?: string;
  password?: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** 失焦校验(§8 inline-validation);文案与后端逐字一致 */
  function validateField(field: 'phone' | 'password'): boolean {
    const err =
      field === 'phone' && !PHONE_RE.test(phone)
        ? '手机号须为1开头的11位数字'
        : field === 'password' && password.length < 6
          ? '密码至少6位'
          : undefined;
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
    return err === undefined;
  }

  function switchMode(next: Mode) {
    setMode(next);
    setFieldErrors({});
    setServerError(null);
  }

  async function submit() {
    const phoneOk = validateField('phone');
    const passwordOk = validateField('password');
    if (!phoneOk || !passwordOk) return;

    setSubmitting(true);
    setServerError(null);
    try {
      if (mode === 'login') {
        await signIn(phone, password);
      } else {
        await signUp(phone, password);
      }
      toast.showToast(mode === 'login' ? '已登录' : '注册成功,欢迎加入食刻');
      router.replace('/');
    } catch (e) {
      // 接口错误文案逐字呈现(§1)
      setServerError(e instanceof ApiError ? e.message : '网络连接失败,请检查网络后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={statics.flex}>
      <ScrollView
        contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 顶栏(§7):返回热区 ≥44 + 衬线标题 */}
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
          <Text style={[type.serifTitle, { color: colors.ink }]}>登录 / 注册</Text>
          <View style={statics.back} />
        </View>

        {/* 双 Tab 切换 */}
        <View style={statics.tabs}>
          {(['login', 'register'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              onPress={() => switchMode(m)}
              style={[statics.tab, mode === m && { backgroundColor: accent.main }]}
            >
              <Text style={[statics.tabText, mode === m && statics.tabTextActive]}>
                {m === 'login' ? '登录' : '注册'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 手机号 */}
        <View style={statics.field}>
          <Text style={statics.label}>
            手机号 <Text style={statics.required}>*</Text>
          </Text>
          <TextInput
            style={[statics.input, fieldErrors.phone && statics.inputError]}
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
            }}
            onBlur={() => validateField('phone')}
            placeholder="1 开头的 11 位数字"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
            textContentType="telephoneNumber"
            maxLength={11}
            autoComplete="tel"
          />
          {!!fieldErrors.phone && (
            <Text accessibilityRole="alert" style={statics.error}>
              {fieldErrors.phone}
            </Text>
          )}
        </View>

        {/* 密码 */}
        <View style={statics.field}>
          <View style={statics.labelRow}>
            <Text style={statics.label}>
              密码 <Text style={statics.required}>*</Text>
            </Text>
            {mode === 'login' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="忘记密码"
                onPress={() => toast.showToast('密码找回接口待上线,可先联系管理员')}
              >
                <Text style={[statics.forgot, { color: accent.deep }]}>忘记密码?</Text>
              </Pressable>
            )}
          </View>
          <View style={[statics.inputWrap, fieldErrors.password && statics.inputError]}>
            <TextInput
              style={statics.passwordInput}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              onBlur={() => validateField('password')}
              placeholder="至少 6 位"
              placeholderTextColor={colors.ink3}
              secureTextEntry={!showPassword}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              autoComplete={mode === 'login' ? 'password' : 'new-password'}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? '隐藏密码' : '显示密码'}
              hitSlop={8}
              onPress={() => setShowPassword((s) => !s)}
              style={statics.eye}
            >
              <EyeIcon off={showPassword} />
            </Pressable>
          </View>
          <Text style={statics.helper}>密码至少 6 位;支持粘贴与密码管理器自动填充</Text>
          {!!fieldErrors.password && (
            <Text accessibilityRole="alert" style={statics.error}>
              {fieldErrors.password}
            </Text>
          )}
        </View>

        {/* 接口错误逐字呈现(401 不正确/已禁用、409 已注册) */}
        {!!serverError && (
          <Text accessibilityRole="alert" style={statics.serverError}>
            {serverError}
          </Text>
        )}

        <View style={statics.submitWrap}>
          <PrimaryButton
            label={mode === 'login' ? '登录' : '注册'}
            loading={submitting}
            onPress={submit}
          />
        </View>

        <Text style={statics.note}>未登录也可浏览官方菜谱与食材库</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** 眼形图标(线性 1.8px,§5 图标族);off = 显示态(加斜杠表示已明文)。 */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"
        stroke={colors.ink3}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z" stroke={colors.ink3} strokeWidth={1.8} />
      {off && <Line x1={4} y1={20} x2={20} y2={4} stroke={colors.ink3} strokeWidth={1.8} strokeLinecap="round" />}
    </Svg>
  );
}

const statics = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 3,
    marginBottom: spacing.s6,
    ...shadows.card.ios,
    elevation: 1,
  },
  tab: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    ...type.bodyStrong,
    color: colors.ink2,
  },
  tabTextActive: {
    color: '#FFFFFF',
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
    color: accent.main,
  },
  forgot: {
    ...type.caption,
    fontWeight: '600',
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  passwordInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    ...type.body,
    color: colors.ink,
  },
  inputError: {
    borderColor: functional.danger,
  },
  eye: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: {
    ...type.caption,
    color: colors.ink3,
    marginTop: spacing.s1,
  },
  error: {
    ...type.caption,
    color: functional.danger,
    marginTop: spacing.s1,
  },
  serverError: {
    ...type.caption,
    color: functional.danger,
    marginTop: spacing.s2,
    textAlign: 'center',
  },
  submitWrap: {
    marginTop: spacing.s6,
  },
  note: {
    ...type.caption,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: spacing.s5,
  },
});
