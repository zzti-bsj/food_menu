/** API 数据类型 —— 与后端契约逐字段对齐(db/schema.sql + web/app.py);后端无统一信封。 */

export type ContentStatus = '待审核' | '已通过' | '已驳回';

/** 列表端点按审核状态三态分组返回;C 端只呈现「已通过」(§10)。 */
export interface StatusGrouped<T> {
  待审核: T[];
  已通过: T[];
  已驳回: T[];
}

export interface User {
  id: number;
  phone: string;
  /** 可空:注册时未设置昵称 */
  nickname: string | null;
  /** 头像 URL,可空(空回退昵称印章);相对路径拼 API_BASE_URL */
  avatar: string | null;
  role: 'user' | 'admin';
  /** 正常 / 禁用 */
  status: string;
}

/** 后端字段名即 token / refresh_token(access 2h / refresh 30 天,refresh 轮换) */
export interface TokenPair {
  token: string;
  refresh_token: string;
}

export interface AuthSession extends TokenPair {
  user: User;
}

/** 食材(db/schema.sql ingredient 表,密码等敏感字段不含) */
export interface Ingredient {
  id: number;
  name: string;
  /** 别名,半角逗号分隔,可空 */
  aliases: string | null;
  /** 分类,大类多选(1-3 个)逗号分隔 */
  category: string;
  /** 四气,单选七档 */
  nature: string;
  /** 五味,多选逗号分隔 */
  flavor: string;
  /** 归经,多选逗号分隔 */
  meridian: string;
  /** 功效,多选(0-3 个)逗号分隔,可空 */
  benefits: string | null;
  /** 时令备注,可空 */
  season_note: string | null;
  /** 食用注意,可空 */
  caution: string | null;
  /** 国学注脚「典籍:原文」格式,可空 */
  classic_note: string | null;
  image: string | null;
  /** 当令节气,逗号分隔多选 */
  solar_terms: string;
  user_id: number | null;
  status: ContentStatus;
  /** 创建/更新时间(后端 DATETIME,列表卡「#id · 日期」展示用) */
  created_at?: string;
  updated_at?: string;
}

/** 菜品(db/schema.sql dish 表) */
export interface Dish {
  id: number;
  name: string;
  /** 出品厨师:健康厨师 / 美食大厨 */
  category: string;
  /** 主料,逗号分隔「食材 分量」 */
  main_ingredients: string;
  /** 辅料/调料,同格式,可空 */
  extras: string | null;
  /** 制作步骤,编号分行 */
  steps: string;
  /** 每份热量估算字符串,如「约350千卡」 */
  calories: string;
  /** 养生好处,中医性味+现代营养多角度 */
  benefits: string;
  /** 风味与文化背景,美食大厨出品,可空 */
  story: string | null;
  image: string | null;
  /** 忌口提示,可空 */
  caution: string | null;
  /** 菜系+烹饪方式,逗号分隔 */
  style: string;
  /** 时令节气,逗号分隔多选 */
  solar_terms: string;
  /** 校验存疑备注,可空 */
  remark: string | null;
  user_id: number | null;
  status: ContentStatus;
  created_at?: string;
  updated_at?: string;
}

/** 封闭值域(GET /api/vocab,编辑表单选项源;benefits = 词条→白话释义) */
export interface ContentVocab {
  solar_terms: string[];
  categories: string[];
  dish_categories: string[];
  cuisines: string[];
  natures: string[];
  flavors: string[];
  meridians: string[];
  benefits: Record<string, string>;
}
