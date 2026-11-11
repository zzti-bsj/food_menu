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
    return (
      <View style={statics.chip}>
        <LinearGradient
          colors={[brand.amber, brand.calorieArc]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={statics.chip}
        >
          <Text style={[statics.text, { color: '#FFFFFF' }]}>美食大厨</Text>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[statics.chip, { backgroundColor: brand.seal }]}>
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
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
