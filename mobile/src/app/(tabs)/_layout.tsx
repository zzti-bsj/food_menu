/** 一级导航(§8):底部 5 Tab,悬浮 Dock 自定义 tabBar,二级页不进 Tab。 */
import { Tabs } from 'expo-router';
import { Dock } from '@/components/layout/dock';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <Dock />}>
      <Tabs.Screen name="index" options={{ title: '今日' }} />
      <Tabs.Screen name="recipes" options={{ title: '菜谱' }} />
      <Tabs.Screen name="ingredients" options={{ title: '食材' }} />
      <Tabs.Screen name="workshop" options={{ title: '工坊' }} />
      <Tabs.Screen name="mine" options={{ title: '我的' }} />
    </Tabs>
  );
}
