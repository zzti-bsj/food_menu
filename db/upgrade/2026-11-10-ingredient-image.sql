USE `shike`;

ALTER TABLE `ingredient`
  ADD COLUMN `image` VARCHAR(500) DEFAULT NULL COMMENT '食材图片URL/路径' AFTER `classic_note`;
