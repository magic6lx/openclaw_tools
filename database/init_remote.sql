-- 创建数据库
CREATE DATABASE IF NOT EXISTS openclaw_tools CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE openclaw_tools;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invitation_code_id INT NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  os_type VARCHAR(50),
  os_version VARCHAR(50),
  hardware_info TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_invitation_code_id (invitation_code_id),
  INDEX idx_status (status),
  INDEX idx_device_id (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 邀请码表
CREATE TABLE IF NOT EXISTS invitation_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(11) NOT NULL UNIQUE,
  status ENUM('active', 'disabled') DEFAULT 'active',
  max_devices INT DEFAULT 3,
  current_devices INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 配置模版表
CREATE TABLE IF NOT EXISTS config_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  tags JSON,
  config_content JSON NOT NULL,
  version VARCHAR(50) DEFAULT '1.0',
  parent_id INT,
  author_id INT,
  reviewer_id INT,
  status ENUM('draft', 'pending', 'approved', 'rejected') DEFAULT 'draft',
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_author_id (author_id),
  INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户配置表
CREATE TABLE IF NOT EXISTS user_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  template_id INT,
  config_content JSON NOT NULL,
  version VARCHAR(50),
  is_active BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_template_id (template_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 日志表
CREATE TABLE IF NOT EXISTS logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  log_type ENUM('operation', 'runtime', 'error', 'performance', 'session', 'channel', 'tool', 'model', 'config', 'security') NOT NULL,
  level ENUM('debug', 'info', 'warn', 'error') DEFAULT 'info',
  content TEXT NOT NULL,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_log_type (log_type),
  INDEX idx_level (level),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 模版审核表
CREATE TABLE IF NOT EXISTS template_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  reviewer_id INT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_template_id (template_id),
  INDEX idx_reviewer_id (reviewer_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 配置发放表
CREATE TABLE IF NOT EXISTS config_distributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  user_id INT,
  distribution_type ENUM('auto', 'manual', 'batch') NOT NULL,
  status ENUM('pending', 'distributed', 'failed') DEFAULT 'pending',
  distribution_config JSON,
  distributed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_template_id (template_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 配置备份表
CREATE TABLE IF NOT EXISTS config_backups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_config_id INT NOT NULL,
  backup_content JSON NOT NULL,
  backup_reason VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_config_id (user_config_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 环境检测表
CREATE TABLE IF NOT EXISTS environment_detections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  os_type VARCHAR(50),
  os_version VARCHAR(50),
  hardware_info JSON,
  network_info JSON,
  detection_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_detection_date (detection_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 统计表
CREATE TABLE IF NOT EXISTS statistics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stat_type VARCHAR(50) NOT NULL,
  stat_key VARCHAR(100) NOT NULL,
  stat_value JSON NOT NULL,
  stat_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stat (stat_type, stat_key, stat_date),
  INDEX idx_stat_type (stat_type),
  INDEX idx_stat_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;