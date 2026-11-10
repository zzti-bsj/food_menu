CREATE DATABASE IF NOT EXISTS `shike`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `shike`;

CREATE TABLE IF NOT EXISTS `ingredient` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`         VARCHAR(50)  NOT NULL COMMENT '名称,唯一',
  `aliases`      VARCHAR(200) DEFAULT NULL COMMENT '别名,半角逗号分隔,可空',
  `category`     VARCHAR(100) NOT NULL COMMENT '分类,大类多选(1-3个),值域见词表-分类',
  `nature`       VARCHAR(10)  NOT NULL COMMENT '四气,单选七档:寒/微寒/凉/平/微温/温/热',
  `flavor`       VARCHAR(50)  NOT NULL COMMENT '五味,多选:酸/苦/甘/辛/咸',
  `meridian`     VARCHAR(100) NOT NULL COMMENT '归经,多选,十二经',
  `benefits`     VARCHAR(200) DEFAULT NULL COMMENT '功效,多选(0-3个),无合适选项可置空,值域见词表-功效',
  `season_note`  VARCHAR(100) DEFAULT NULL COMMENT '时令备注,可空,如「全年」「9-11月」',
  `caution`      VARCHAR(500) DEFAULT NULL COMMENT '食用注意,可空',
  `classic_note` VARCHAR(500) DEFAULT NULL COMMENT '国学注脚,典籍出处+一句原文,可空',
  `solar_terms`  VARCHAR(100) NOT NULL COMMENT '当令节气,多选,按节气序号升序写入',
  `user_id`      BIGINT UNSIGNED DEFAULT NULL COMMENT '归属用户,NULL=官方库',
  `status`       VARCHAR(10)  NOT NULL DEFAULT '待审核' COMMENT '审核状态:待审核/已通过/已驳回',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `chk_nature` CHECK (`nature` IN ('寒','微寒','凉','平','微温','温','热'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食材表';

CREATE TABLE IF NOT EXISTS `dish` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`         VARCHAR(100) NOT NULL COMMENT '菜名,唯一',
  `category`     VARCHAR(50)  NOT NULL COMMENT '出品厨师,单选,值域见词表-菜品分类:健康厨师/美食大厨',
  `main_ingredients` VARCHAR(500) NOT NULL COMMENT '主料,逗号分隔「食材 分量」,每份定量,如「白萝卜 半根,鸡胸肉 1块」',
  `extras`       VARCHAR(500) DEFAULT NULL COMMENT '辅料/调料,逗号分隔「名称 分量」,可空',
  `steps`        TEXT NOT NULL COMMENT '制作步骤,编号分行,火候与技巧写入步骤',
  `calories`     VARCHAR(50)  NOT NULL COMMENT '每份热量估算,如「约350千卡」',
  `benefits`     VARCHAR(500) NOT NULL COMMENT '养生好处,中医性味+现代营养多角度',
  `story`        VARCHAR(500) DEFAULT NULL COMMENT '风味与文化背景,美食大厨出品',
  `image`        VARCHAR(500) DEFAULT NULL COMMENT '菜品图片URL/路径',
  `caution`      VARCHAR(500) DEFAULT NULL COMMENT '忌口提示,不适宜人群,可空',
  `style`        VARCHAR(100) NOT NULL COMMENT '菜系+烹饪方式,逗号分隔,如「日式,凉拌」',
  `solar_terms`  VARCHAR(100) NOT NULL COMMENT '时令节气,多选升序,值域同词表-节气',
  `remark`       VARCHAR(500) DEFAULT NULL COMMENT '备注,校验存疑问题逐条分行罗列;无问题为空',
  `user_id`      BIGINT UNSIGNED DEFAULT NULL COMMENT '归属用户,NULL=官方库',
  `status`       VARCHAR(10)  NOT NULL DEFAULT '待审核' COMMENT '审核状态:待审核/已通过/已驳回',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品表';

CREATE TABLE IF NOT EXISTS `user` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `phone`         VARCHAR(20)  NOT NULL COMMENT '手机号,登录凭证,唯一',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希(werkzeug),不存明文',
  `nickname`      VARCHAR(50)  DEFAULT NULL COMMENT '展示名,可空,缺省以手机号掩码显示',
  `role`          VARCHAR(10)  NOT NULL DEFAULT 'user' COMMENT '角色:user/admin,admin功能预留',
  `status`        VARCHAR(10)  NOT NULL DEFAULT '正常' COMMENT '状态:正常/禁用,禁用为封禁预留',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  CONSTRAINT `chk_role` CHECK (`role` IN ('user','admin')),
  CONSTRAINT `chk_user_status` CHECK (`status` IN ('正常','禁用'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
