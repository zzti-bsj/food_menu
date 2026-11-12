-- 内容归属模型:官方(user_id IS NULL)/个人(user_id = 产出者)
-- 重名防重从全局唯一改为「按归属隔离」:官方(NULL 归 0 组)防重,个人各自命名空间。
-- MySQL 8.0.13+ 支持功能索引(8.0.33 实测环境满足)。
USE `shike`;

ALTER TABLE `ingredient`
  DROP INDEX `uk_name`,
  ADD UNIQUE KEY `uk_name_owner` ((COALESCE(`user_id`, 0)), `name`);

ALTER TABLE `dish`
  DROP INDEX `uk_name`,
  ADD UNIQUE KEY `uk_name_owner` ((COALESCE(`user_id`, 0)), `name`);
