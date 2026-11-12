/** 四气徽章(§2.5,功能信息色+字双编码)与出品厨师徽章(§10:健康厨师=朱砂、美食大厨=琥珀)。 */
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, colors, natureBadges } from '@/theme/tokens';
import { radius } from '@/theme/theme';

export function NatureBadge({ nature }: { nature: string }) {
  const tone = natureBadges[nature] ?? { bg: colors.surface2, fg: colors.ink2 };
  return (
    <View style={[statics.chip, { backgroundColor: tone.bg }]}>
      <Text style={[statics.text, { color: tone.fg }]}>{nature}</Text>
    </View>
  );
}

export function ChefBadge({ category }: { category: string }) {
  if (category === '美食大厨') {
    // 设计 .r-chip.chef-cuisine:渐变即徽章层(单层 padding),墨棕字 + 同色投影
    return (
      <LinearGradient
        colors={[brand.amberLight, brand.amber]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[statics.chip, statics.chefShadowAmber]}
      >
        <Text style={[statics.text, { color: brand.amberInk }]}>美食大厨</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={[statics.chip, statics.chefShadowSeal]}>
      <Text style={[statics.text, { color: '#FFFFFF' }]}>{category || '健康厨师'}</Text>
    </View>
  );
}

const statics = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.s,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chefShadowSeal: {
    backgroundColor: brand.seal,
    shadowColor: brand.seal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  chefShadowAmber: {
    shadowColor: brand.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});
