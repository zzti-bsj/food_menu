USE `shike`;

ALTER TABLE `dish`
  ADD COLUMN `story` VARCHAR(500) DEFAULT NULL COMMENT '风味与文化背景,美食大厨出品' AFTER `benefits`,
  ADD COLUMN `image` VARCHAR(500) DEFAULT NULL COMMENT '菜品图片URL/路径' AFTER `story`;
