-- ============================================================
-- Chat Backend – PostgreSQL Schema
-- Run via: npm run migrate
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username    VARCHAR(50)  NOT NULL UNIQUE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Chats ────────────────────────────────────────────────────────────────
-- Represents a 1:1 chat session.
CREATE TABLE IF NOT EXISTS chats (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Chat Members ─────────────────────────────────────────────────────────
-- Junction table linking users to chats (exactly 2 rows per 1:1 chat).
CREATE TABLE IF NOT EXISTS chat_members (
  chat_id               UUID        NOT NULL REFERENCES chats(id)    ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_message_id  VARCHAR(255),       -- Firestore document ID

  PRIMARY KEY (chat_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id  ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id  ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username        ON users(username);

-- ─── Helper function: auto-update updated_at ──────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_users_updated_at'
  ) THEN
    CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Attach trigger to chats
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_chats_updated_at'
  ) THEN
    CREATE TRIGGER trigger_chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── Seed: Sample Users (for local development) ───────────────────────────
-- These are only inserted if they don't already exist.
INSERT INTO users (id, username, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'alice', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'bob',   'bob@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'carol', 'carol@example.com')
ON CONFLICT DO NOTHING;
