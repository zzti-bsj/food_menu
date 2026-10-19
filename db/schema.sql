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
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  CONSTRAINT `chk_nature` CHECK (`nature` IN ('寒','微寒','凉','平','微温','温','热'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食材表';
