-- OpenClaw Tools 数据库初始化脚本
-- 数据库: openclaw_tools
-- 注意：此脚本会清空所有旧表重建

CREATE DATABASE IF NOT EXISTS openclaw_tools DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE openclaw_tools;

-- 删除旧表（清空重建）
DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS invitations;

-- 邀请码表
CREATE TABLE invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE COMMENT '邀请码',
  max_devices INT DEFAULT 3 COMMENT '最大设备数',
  used_devices INT DEFAULT 0 COMMENT '已使用设备数',
  status ENUM('active', 'disabled') DEFAULT 'active' COMMENT '状态',
  role ENUM('admin', 'user') DEFAULT 'user' COMMENT '角色',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请码表';

-- 设备表
CREATE TABLE devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(128) NOT NULL UNIQUE COMMENT '设备ID',
  invitation_id INT COMMENT '关联邀请码ID',
  device_name VARCHAR(128) DEFAULT '' COMMENT '设备名称',
  os_type VARCHAR(32) DEFAULT '' COMMENT '操作系统类型',
  os_version VARCHAR(64) DEFAULT '' COMMENT '操作系统版本',
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_invitation_id (invitation_id),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备表';

-- 日志表
CREATE TABLE logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(128) DEFAULT '' COMMENT '设备ID',
  level ENUM('debug', 'info', 'warn', 'error') DEFAULT 'info' COMMENT '日志级别',
  source VARCHAR(64) DEFAULT '' COMMENT '日志来源',
  message TEXT COMMENT '日志内容',
  client_timestamp TIMESTAMP NULL COMMENT '客户端时间戳',
  server_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '服务器时间戳',
  INDEX idx_device_id (device_id),
  INDEX idx_level (level),
  INDEX idx_source (source),
  INDEX idx_server_timestamp (server_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='日志表';

-- 模版表
CREATE TABLE templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '模版名称',
  description TEXT COMMENT '模版描述',
  config JSON COMMENT '配置内容',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审核状态',
  created_by INT COMMENT '创建者邀请码ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配置模版表';

-- 初始化默认邀请码
INSERT INTO invitations (code, max_devices, used_devices, status, role) VALUES
  ('ADMIN12345678', 10, 0, 'active', 'admin'),
  ('USER98765432', 3, 1, 'active', 'user'),
  ('TEST11111111', 1, 1, 'disabled', 'user');
