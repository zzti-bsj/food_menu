/** 收录食材(私有食单入口二,对照 my-content.html 单类拆分):仅食材列表与搜索。 */
import { MineContentScreen } from '@/components/content/mine-list';

export default function MyIngredientsScreen() {
  return <MineContentScreen kind="ingredient" />;
}
