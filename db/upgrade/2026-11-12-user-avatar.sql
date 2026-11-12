-- 2026-11-12: 用户头像(user.avatar)——移动端编辑资料支持上传/更换头像
-- URL 存 image 同款规范:≤500 字,相对路径由客户端拼 API_BASE_URL
USE `shike`;
ALTER TABLE `user`
  ADD COLUMN `avatar` VARCHAR(500) DEFAULT NULL COMMENT '头像图片URL/路径,可空(空则回退昵称印章)' AFTER `nickname`;
