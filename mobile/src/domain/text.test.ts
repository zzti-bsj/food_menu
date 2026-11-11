/** 行内字段解析测试(schema.sql 注释口径的样例数据)。 */
import { dishIngredientNames, parseIngredients, parseSteps, parseStyle, splitList } from '@/utils/text';
import type { Dish } from '@/api/types';

describe('parseIngredients', () => {
  it('「白萝卜 半根,鸡胸肉 1块」→ 名称+分量', () => {
    expect(parseIngredients('白萝卜 半根,鸡胸肉 1块')).toEqual([
      { name: '白萝卜', amount: '半根' },
      { name: '鸡胸肉', amount: '1块' },
    ]);
  });

  it('无分量条目 amount 为 null;空段过滤', () => {
    expect(parseIngredients('豆豉 15g,,盐')).toEqual([
      { name: '豆豉', amount: '15g' },
      { name: '盐', amount: null },
    ]);
  });
});

describe('parseSteps', () => {
  it('去掉「1. / 2、」编号保留正文', () => {
    expect(parseSteps('1. 排骨冷水下锅焯水\n2、大火蒸 25 分钟')).toEqual([
      '排骨冷水下锅焯水',
      '大火蒸 25 分钟',
    ]);
  });
});

describe('splitList / parseStyle', () => {
  it('splitList 处理逗号与空白', () => {
    expect(splitList('肺经,脾经, 胃经')).toEqual(['肺经', '脾经', '胃经']);
    expect(splitList(null)).toEqual([]);
  });

  it('parseStyle 双段取菜系+做法;单段两者同值', () => {
    expect(parseStyle('日式,凉拌')).toEqual({ cuisine: '日式', method: '凉拌' });
    expect(parseStyle('粤式')).toEqual({ cuisine: '粤式', method: '粤式' });
  });
});

describe('dishIngredientNames', () => {
  it('主料+辅料去重保序', () => {
    const dish = {
      main_ingredients: '排骨 400g,豆豉 15g',
      extras: '蒜末,豆豉 15g',
    } as Dish;
    expect(dishIngredientNames(dish)).toEqual(['排骨', '豆豉', '蒜末']);
  });
});
