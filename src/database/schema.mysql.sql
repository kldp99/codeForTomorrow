-- ============================================================
-- Chat Backend – MySQL Schema (Aiven Cloud)
-- Run via: npm run migrate:mysql
-- ============================================================

-- ─── Users ─────────────────────────────────────────────────────────────────
-- Stores application users. `id` is a client-generated UUID (CHAR 36).
-- `name` is the display name; `email` is unique but nullable
-- (allows creating users without an email if needed).
CREATE TABLE IF NOT EXISTS users (
  id         CHAR(36)     NOT NULL,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NULL UNIQUE,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for fast email look-ups (created separately; migrator skips if already exists)
CREATE INDEX idx_users_email ON users(email);

-- ─── Chats ──────────────────────────────────────────────────────────────────
-- Represents a chat session.
-- `chat_type`        : Enum for extensibility (currently only ONE_TO_ONE).
-- `conversation_key` : Deterministic, order-independent key for 1:1 chats.
--                      Built as LEAST(userA_id, userB_id) || '_' || GREATEST(userA_id, userB_id).
--                      The UNIQUE constraint guarantees there is exactly one chat
--                      between any two users, regardless of which user initiated it.
CREATE TABLE IF NOT EXISTS chats (
  id               CHAR(36)                     NOT NULL,
  chat_type        ENUM('ONE_TO_ONE')            NOT NULL DEFAULT 'ONE_TO_ONE',
  conversation_key VARCHAR(73)                  NOT NULL,   -- 36 + '_' + 36 = 73 chars
  created_at       DATETIME(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_chats_conversation_key (conversation_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for updated_at (used for ordering user chat lists)
CREATE INDEX idx_chats_updated_at ON chats(updated_at);

-- ─── Chat Members ────────────────────────────────────────────────────────────
-- Junction table: links users to chats.
-- For a ONE_TO_ONE chat there are exactly 2 rows.
-- The UNIQUE KEY on (chat_id, user_id) prevents duplicate membership.
CREATE TABLE IF NOT EXISTS chat_members (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chat_id   CHAR(36)        NOT NULL,
  user_id   CHAR(36)        NOT NULL,
  joined_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),

  -- Prevent a user from being added to the same chat twice
  UNIQUE KEY uq_chat_members_chat_user (chat_id, user_id),

  CONSTRAINT fk_chat_members_chat
    FOREIGN KEY (chat_id) REFERENCES chats(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_chat_members_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for fetching all chats a user belongs to
CREATE INDEX idx_chat_members_user_id ON chat_members(user_id);
-- Index for fetching all members of a chat
CREATE INDEX idx_chat_members_chat_id ON chat_members(chat_id);

-- ─── Seed: Sample Users (for local / CI testing) ──────────────────────────
-- Only inserted if they don't already exist (INSERT IGNORE).
INSERT IGNORE INTO users (id, name, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Alice', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'Bob',   'bob@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'Carol', 'carol@example.com');

