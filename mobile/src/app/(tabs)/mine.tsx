/** 我的(Tab 5)—— 对照 mine.html v1.4.3:衬线页题 + 右上角齿轮 +
 *  资料头部(粉彩卡:头像章 + 相机角标 + 昵称/角色/掩码·ID,点按 → 编辑资料)+
 *  入口列表(私有食单带计数 / 官方库审核 / 用户管理[admin] / 设置)。退出在设置页。 */
import { type ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanelPop, Seal, Sparkle } from '@/components/brand';
import { CameraIcon, ChevronRightIcon, GearIcon, LeafLineIcon, PenIcon, ShieldIcon } from '@/components/icons';
import { useAuth } from '@/auth/auth-context';
import { listDishGroups, listIngredientGroups } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { resolveImageUrl } from '@/components/content/food-image';
import type { Dish, Ingredient } from '@/api/types';
import { colors, seasons, activeSeason } from '@/theme/tokens';
import { fontDisplay, pagePad, radius, shadows, spacing, type } from '@/theme/theme';

const accent = seasons[activeSeason];
const summer = seasons.summer;

/** 手机掩码:13800000000 → 138****0000 */
function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

export default function MineScreen() {
  const { user, restoring } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 入口计数:与私有食单口径一致,仅「已通过」(待审核在审核台;已驳回在审核台可删除)
  const { data: mine } = useAsync(async () => {
    const [dishGroups, ingredientGroups] = await Promise.all([
      listDishGroups(),
      listIngredientGroups(),
    ]);
    const mineOf = (rows: (Dish | Ingredient)[]): number =>
      rows.filter((row) => row.user_id === user?.id).length;
    return {
      dishes: mineOf(dishGroups.已通过),
      ingredients: mineOf(ingredientGroups.已通过),
    };
  }, [user?.id]);

  return (
    <ScrollView
      contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s4, paddingBottom: 122 + insets.bottom }]}
    >
      {/* 页题 + 右上角齿轮直达设置 */}
      <View style={statics.titleRow}>
        <Text style={statics.pageTitle}>我的</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="设置"
          hitSlop={8}
          onPress={() => router.push('/settings')}
          style={statics.gear}
        >
          <GearIcon size={22} color={colors.ink2} />
        </Pressable>
      </View>

      {restoring ? (
        <View style={statics.skeletonCard}>
          <Text style={[type.body, { color: colors.ink3 }]}>正在恢复登录态…</Text>
        </View>
      ) : user ? (
        <>
          {/* 资料头部:点按 → 编辑资料 */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="编辑资料"
            onPress={() => router.push('/edit-profile')}
            style={({ pressed }) => [statics.profileWrap, pressed && { opacity: 0.92 }]}
          >
            <PanelPop season={activeSeason}>
              <View style={statics.profile}>
                <View style={statics.avatarWrap}>
                  {user.avatar ? (
                    <Image
                      source={{ uri: resolveImageUrl(user.avatar) }}
                      style={statics.avatarImg}
                      contentFit="cover"
                      accessibilityLabel="头像"
                    />
                  ) : (
                    <Seal char={user.nickname?.[0] ?? '食'} />
                  )}
                  <View style={statics.avatarCam}>
                    <CameraIcon color={colors.surface} />
                  </View>
                </View>
                <View style={statics.profileMeta}>
                  <View style={statics.nameRow}>
                    <Text style={statics.nickname}>{user.nickname ?? '食客'}</Text>
                    <View
                      style={[
                        statics.roleBadge,
                        user.role === 'admin' && { backgroundColor: summer.soft },
                      ]}
                    >
                      <Text style={[statics.roleText, user.role === 'admin' && { color: summer.deep }]}>
                        {user.role === 'admin' ? '管理员' : '用户'}
                      </Text>
                    </View>
                  </View>
                  <Text style={statics.pid}>
                    {maskPhone(user.phone)} · ID {user.id}
                  </Text>
                </View>
                <ChevronRightIcon size={20} color={colors.ink3} />
              </View>
            </PanelPop>
          </Pressable>

          {/* 功能入口:单一白色大组包裹 */}
          <View style={[statics.entryGroup, shadows.card.android]}>
            <EntryRow
              icon={<PenIcon color={accent.deep} />}
              iconBg={accent.soft}
              title="我的菜谱"
              count={mine ? `${mine.dishes} 道` : undefined}
              onPress={() => router.push('/my-dishes')}
            />
            <EntryRow
              icon={<LeafLineIcon color={seasons.spring.deep} />}
              iconBg={seasons.spring.soft}
              title="收录食材"
              count={mine ? `${mine.ingredients} 味` : undefined}
              onPress={() => router.push('/my-ingredients')}
            />
            {user.role === 'admin' && (
              <EntryRow
                icon={<ShieldIcon color={summer.deep} />}
                iconBg={summer.soft}
                title="用户管理"
                sub="启停 / 角色 / 删除"
                tag="admin"
                last
                onPress={() => router.push('/admin-users')}
              />
            )}
          </View>

        </>
      ) : (
        /* 未登录:入口列表隐藏,保留登录引导 */
        <View style={[statics.skeletonCard, statics.loginCard]}>
          <Text style={[type.bodyStrong, { color: colors.ink }]}>未登录</Text>
          <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s1 }]}>
            登录后可使用私有食单、官方库审核与设置
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/login')}
            style={({ pressed }) => [statics.loginBtn, pressed && { opacity: 0.88 }]}
          >
            <Text style={statics.loginBtnText}>登录 / 注册</Text>
          </Pressable>
        </View>
      )}

      {/* AI 生成声明:一行小灰字,低调提示(不抢视觉) */}
      <Text style={statics.aiNote}>食材与菜谱由 AI 生成,仅供参考</Text>
    </ScrollView>
  );
}

interface EntryRowProps {
  icon: ReactNode;
  iconBg: string;
  title: string;
  sub?: string;
  count?: string;
  tag?: string;
  last?: boolean;
  onPress: () => void;
}

function EntryRow({ icon, iconBg, title, sub, count, tag, last, onPress }: EntryRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [statics.entryRow, !last && statics.entryRowBordered, pressed && { backgroundColor: colors.surface2 }]}
    >
      <View style={[statics.entryIcon, { backgroundColor: iconBg }]} aria-hidden>
        {icon}
      </View>
      <View style={statics.entryGrow}>
        <Text style={statics.entryTitle}>{title}</Text>
        {!!sub && <Text style={statics.entrySub}>{sub}</Text>}
      </View>
      {!!count && (
        <View style={statics.entryCount}>
          <Text style={statics.entryCountText}>{count}</Text>
        </View>
      )}
      {!!tag && (
        <View style={statics.entryTag}>
          <Text style={statics.entryTagText}>{tag}</Text>
        </View>
      )}
      <ChevronRightIcon size={18} color={colors.ink3} />
    </Pressable>
  );
}

const statics = StyleSheet.create({
  content: {
    backgroundColor: colors.bg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pagePad,
    marginBottom: spacing.s5,
  },
  pageTitle: {
    fontFamily: fontDisplay,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.ink,
  },
  gear: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileWrap: {
    paddingHorizontal: pagePad,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    padding: spacing.s4,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarCam: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  profileMeta: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  nickname: {
    ...type.bodyStrong,
    fontSize: 18,
    lineHeight: 25,
    color: colors.ink,
  },
  roleBadge: {
    borderRadius: 6,
    backgroundColor: accent.soft,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: accent.deep,
  },
  pid: {
    ...type.caption,
    color: colors.ink2,
  },
  entryGroup: {
    marginHorizontal: pagePad,
    marginTop: spacing.s4,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.m,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingVertical: 13,
    paddingHorizontal: spacing.s4,
    borderRadius: radius.m,
  },
  entryRowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    borderStyle: 'dashed',
    borderRadius: 0,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryGrow: {
    flex: 1,
    minWidth: 0,
  },
  entryTitle: {
    ...type.body,
    fontWeight: '600',
    color: colors.ink,
  },
  entrySub: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.ink3,
    marginTop: 2,
  },
  entryCount: {
    backgroundColor: colors.surface2,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  entryCountText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.ink2,
  },
  entryTag: {
    backgroundColor: summer.soft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  entryTagText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    color: summer.deep,
  },
  skeletonCard: {
    marginHorizontal: pagePad,
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s4,
  },
  loginCard: {
    gap: spacing.s3,
    alignItems: 'flex-start',
  },
  loginBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 15,
    backgroundColor: accent.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    ...type.bodyStrong,
    color: colors.surface,
  },
  /** AI 生成声明:居中一行,13px 辅助灰,不构成视觉焦点 */
  aiNote: {
    ...type.caption,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: spacing.s6,
    paddingHorizontal: pagePad,
  },
});
