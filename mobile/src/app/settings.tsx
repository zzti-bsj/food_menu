/** 设置(登录 push,对照 settings.html v1.4.3 极简两块):
 *  入节提醒开关(本地,预留定时任务)· 退出登录(danger + 确认弹层)。 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { pagePad, radius, shadows, spacing, type } from '@/theme/theme';

const accent = seasons[activeSeason];

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [reminder, setReminder] = useState(false);

  /** 未登录不展示设置(入口在登录态我的页);防御性兜底 */
  if (!user) {
    return (
      <View style={[statics.centered, { paddingTop: insets.top }]}>
        <Text style={[type.body, { color: colors.ink2 }]}>请先登录</Text>
      </View>
    );
  }

  function confirmSignOut() {
    Alert.alert('退出登录', '退出后本机令牌将被清除,需要重新登录', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          signOut();
          toast.showToast('已退出登录');
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2, paddingBottom: 122 + insets.bottom }]}>
      <View style={statics.topBar}>
        <Text style={[type.serifTitle, { color: colors.ink }]}>设置</Text>
      </View>

      {/* 入节提醒 */}
      <View style={[statics.group, shadows.card.android]}>
        <View style={statics.row}>
          <View style={statics.rowGrow}>
            <Text style={statics.rowTitle}>入节提醒</Text>
            <Text style={statics.rowSub}>节气切换当天推送提醒(定时任务预留)</Text>
          </View>
          <Switch
            value={reminder}
            onValueChange={(v) => {
              setReminder(v);
              if (v) toast.showToast('已开启入节提醒(推送待上线,当前本地生效)');
            }}
            trackColor={{ false: colors.lineStrong, true: functional.success }}
            accessibilityLabel="入节提醒"
          />
        </View>
      </View>

      {/* 退出登录 */}
      <View style={[statics.group, shadows.card.android]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="退出登录"
          onPress={confirmSignOut}
          style={({ pressed }) => [statics.dangerRow, pressed && { backgroundColor: colors.surface2 }]}
        >
          <Text style={statics.dangerText}>退出登录</Text>
        </Pressable>
      </View>

      <Text style={[type.caption, statics.footnote, { color: colors.ink3 }]}>
        修改密码入口在登录页「忘记密码」;重置接口待补
      </Text>
    </ScrollView>
  );
}

const statics = StyleSheet.create({
  content: {
    backgroundColor: colors.bg,
    paddingHorizontal: pagePad,
  },
  topBar: {
    height: 44,
    justifyContent: 'center',
    marginBottom: spacing.s4,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginBottom: spacing.s4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.s4,
    gap: spacing.s3,
  },
  rowGrow: {
    flex: 1,
  },
  rowTitle: {
    ...type.body,
    fontWeight: '600',
    color: colors.ink,
  },
  rowSub: {
    ...type.caption,
    color: colors.ink3,
    marginTop: 2,
  },
  dangerRow: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.m,
  },
  dangerText: {
    ...type.body,
    fontWeight: '600',
    color: functional.danger,
  },
  footnote: {
    textAlign: 'center',
    marginTop: spacing.s2,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
