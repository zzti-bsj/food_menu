/** 我的菜谱(私有食单入口一,对照 my-content.html 单类拆分):仅菜品列表与搜索。 */
import { MineContentScreen } from '@/components/content/mine-list';

export default function MyDishesScreen() {
  return <MineContentScreen kind="dish" />;
}
