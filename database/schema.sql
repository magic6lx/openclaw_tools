-- OpenClaw智能配置系统数据库表结构
-- 版本: V1.0
-- 创建日期: 2026-03-17

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
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_device (invitation_code_id, device_id),
  INDEX idx_invitation_code (invitation_code_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 邀请码表
CREATE TABLE IF NOT EXISTS invitation_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(11) NOT NULL UNIQUE,
  status ENUM('active', 'disabled') DEFAULT 'active',
  role ENUM('user', 'admin') DEFAULT 'user' COMMENT '邀请码角色：user=普通用户, admin=管理员',
  max_devices INT DEFAULT 3,
  current_devices INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_status (status),
  INDEX idx_role (role)
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
  status ENUM('draft', 'pending', 'approved', 'rejected') DEFAULT 'draft',
  author_id INT,
  reviewer_id INT,
  review_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_author (author_id),
  INDEX idx_parent (parent_id),
  FOREIGN KEY (parent_id) REFERENCES config_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户配置表
CREATE TABLE IF NOT EXISTS user_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  template_id INT,
  config_content JSON NOT NULL,
  version VARCHAR(50),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_template (template_id),
  INDEX idx_active (is_active),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES config_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 日志表
CREATE TABLE IF NOT EXISTS logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  log_type ENUM('operation', 'runtime', 'error', 'performance', 'session', 'channel', 'tool', 'model', 'config', 'security') NOT NULL,
  level ENUM('debug', 'info', 'warn', 'error') DEFAULT 'info',
  content TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_type (log_type),
  INDEX idx_level (level),
  INDEX idx_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 模版审核表
CREATE TABLE IF NOT EXISTS template_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  reviewer_id INT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_template (template_id),
  INDEX idx_reviewer (reviewer_id),
  INDEX idx_status (status),
  FOREIGN KEY (template_id) REFERENCES config_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 配置发放记录表
CREATE TABLE IF NOT EXISTS config_distributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invitation_code_id INT NOT NULL,
  template_id INT NOT NULL,
  version VARCHAR(50),
  distributed_by INT,
  distributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMP NULL,
  usage_limit INT,
  current_usage INT DEFAULT 0,
  status ENUM('active', 'expired', 'revoked') DEFAULT 'active',
  INDEX idx_invitation_code (invitation_code_id),
  INDEX idx_template (template_id),
  INDEX idx_status (status),
  FOREIGN KEY (invitation_code_id) REFERENCES invitation_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES config_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 配置备份表
CREATE TABLE IF NOT EXISTS config_backups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  config_content JSON NOT NULL,
  backup_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 环境检测记录表
CREATE TABLE IF NOT EXISTS environment_detections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  os_type VARCHAR(50),
  os_version VARCHAR(50),
  cpu_info VARCHAR(255),
  memory_info VARCHAR(255),
  disk_info VARCHAR(255),
  network_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 统计数据表
CREATE TABLE IF NOT EXISTS statistics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stat_type VARCHAR(50) NOT NULL,
  stat_key VARCHAR(100) NOT NULL,
  stat_value BIGINT DEFAULT 0,
  stat_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_stat (stat_type, stat_key, stat_date),
  INDEX idx_type_date (stat_type, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;