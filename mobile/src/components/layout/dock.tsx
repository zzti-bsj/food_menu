/** 悬浮 Dock(§7,对齐 assets/theme.css .tabbar):距边 14 · padding 8 · gap 4 · radius 26;
 *  选中 = 整项(icon+label)accent 淡底 + radius 18 + accent-deep 字 700;按压 scale(.94)。
 *  白色吃掉区:Dock 周边渲染白色(顶缘 18px 圆弧),滚动内容下滑被吞没。 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, seasons, activeSeason } from '@/theme/tokens';
import { shadows, type, z } from '@/theme/theme';

const accent = seasons[activeSeason];

/** 5 个一级 Tab 与 DESIGN-SYSTEM.md §8 导航结构一一对应 */
const TABS = [
  { path: '/', label: '今日', Icon: HouseIcon },
  { path: '/recipes', label: '菜谱', Icon: BookIcon },
  { path: '/ingredients', label: '食材', Icon: LeafIcon },
  { path: '/workshop', label: '工坊', Icon: PotIcon },
  { path: '/mine', label: '我的', Icon: UserIcon },
] as const;

const BAR_HEIGHT = 66;

export function Dock() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const dockBottom = insets.bottom + 8;
  // 吃掉区顶缘 = Dock 顶缘上方 6(theme.css ::before top:-6)
  const eatZoneHeight = BAR_HEIGHT + dockBottom + 6;

  return (
    <View pointerEvents="box-none" style={statics.root}>
      <View pointerEvents="none" style={[statics.eatZone, { height: eatZoneHeight }]} />
      <View style={[statics.bar, shadows.lift.ios, shadows.lift.android, { bottom: dockBottom }]}>
        {TABS.map((tab) => {
          const focused = pathname === tab.path;
          const tint = focused ? accent.deep : colors.ink3;
          return (
            <Pressable
              key={tab.path}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => router.push(tab.path)}
              style={({ pressed }) => [
                statics.item,
                focused && { backgroundColor: accent.soft },
                pressed && statics.itemPressed,
              ]}
            >
              <tab.Icon color={tint} />
              <Text style={[statics.label, { color: tint }, focused && statics.labelFocused]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ---- 线性图标(24 viewBox · 1.8 stroke · round) ---- */
interface IconProps {
  color: string;
}

const svgBase = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none' } as const;

function IconPath({ color, d }: IconProps & { d: string }) {
  return (
    <Svg {...svgBase}>
      <Path
        d={d}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HouseIcon({ color }: IconProps) {
  return <IconPath color={color} d="M4 11.2 12 4.5l8 6.7M6 9.8V19.5h12V9.8M10 19.5v-5h4v5" />;
}
function BookIcon({ color }: IconProps) {
  return <IconPath color={color} d="M12 6.4C10.2 5 7.8 4.4 4 4.4v14.2c3.8 0 6.2.6 8 2 1.8-1.4 4.2-2 8-2V4.4c-3.8 0-6.2.6-8 2zM12 6.4v14" />;
}
function LeafIcon({ color }: IconProps) {
  return <IconPath color={color} d="M5.5 18.5C5.5 10.5 11 5 19.5 4.5c.4 8.5-5 14-14 14zM5.5 18.5c2.6-4.6 6-8 10.5-10.4" />;
}
function PotIcon({ color }: IconProps) {
  return <IconPath color={color} d="M5 11h14v4.2a4.8 4.8 0 0 1-4.8 4.8H9.8A4.8 4.8 0 0 1 5 15.2V11zM3 11h18M9 8.2c0-1.2 1-1.2 1-2.4M14 8.2c0-1.2 1-1.2 1-2.4" />;
}
function UserIcon({ color }: IconProps) {
  return <IconPath color={color} d="M12 11.5a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4zM4.5 20c1.4-3.2 4.2-4.8 7.5-4.8s6.1 1.6 7.5 4.8" />;
}

const statics = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: z.dock,
  },
  eatZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
    height: BAR_HEIGHT,
    padding: 8,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 18,
    paddingVertical: 4,
  },
  itemPressed: {
    transform: [{ scale: 0.94 }],
  },
  label: {
    ...type.navLabel,
  },
  labelFocused: {
    fontWeight: '700',
  },
});
