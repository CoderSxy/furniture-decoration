CREATE DATABASE IF NOT EXISTS furniture DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 实际库名以 MYSQL_DATABASE 为准；本文件供人工在 ECS 执行。

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  openid VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  last_login_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_items (
  user_id CHAR(36) NOT NULL,
  kind ENUM('favorite','plan','budget','scan','aiPreview','preference') NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  payload JSON NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (user_id, kind, item_id),
  KEY idx_sync_user_updated (user_id, updated_at),
  CONSTRAINT fk_sync_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
