USE `shike`;

-- 用户表(手机号+密码;role=admin 功能预留)
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

-- 内容归属列(NULL=官方库;用户之间内容不可见)
ALTER TABLE `ingredient`
  ADD COLUMN `user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '归属用户,NULL=官方库' AFTER `solar_terms`,
  ADD INDEX `idx_user_id` (`user_id`);

ALTER TABLE `dish`
  ADD COLUMN `user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '归属用户,NULL=官方库' AFTER `solar_terms`,
  ADD INDEX `idx_user_id` (`user_id`);
