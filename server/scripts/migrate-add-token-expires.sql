-- 添加 token_expires_days 字段到 invitations 表
-- 如果字段已存在则跳过

ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS token_expires_days INT DEFAULT 30 COMMENT 'Token过期天数';

-- 更新现有记录的默认值
UPDATE invitations SET token_expires_days = 30 WHERE token_expires_days IS NULL;
