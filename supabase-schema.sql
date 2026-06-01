-- ── Run this entire file in Supabase SQL Editor ─────────────────────────────
-- Go to: supabase.com → your project → SQL Editor → New Query → paste → Run

-- Posts table: stores every LinkedIn post seen (official and non-official)
CREATE TABLE IF NOT EXISTS posts (
  id           TEXT PRIMARY KEY,
  competitor   TEXT NOT NULL,
  text         TEXT,
  summary      TEXT,
  category     TEXT,
  posted_at    TEXT,
  post_url     TEXT,
  is_official  BOOLEAN DEFAULT false,
  fetched_at   TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries by competitor and fetch time
CREATE INDEX IF NOT EXISTS idx_posts_competitor  ON posts(competitor);
CREATE INDEX IF NOT EXISTS idx_posts_fetched_at  ON posts(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_is_official ON posts(is_official);

-- Poll log table: records every scrape run
CREATE TABLE IF NOT EXISTS poll_log (
  id         BIGSERIAL PRIMARY KEY,
  run_at     TIMESTAMPTZ DEFAULT now(),
  new_posts  INTEGER DEFAULT 0,
  status     TEXT DEFAULT 'success'
);

-- Enable Row Level Security (RLS) — our functions use service key so this is fine
ALTER TABLE posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_log ENABLE ROW LEVEL SECURITY;

-- Allow read access to posts for anyone (the portal frontend reads this via API)
-- Write access is only via service key (used by Netlify functions)
CREATE POLICY "Public read posts"
  ON posts FOR SELECT
  USING (true);

-- Confirm tables created
SELECT 'posts table ready ✅' AS status
UNION ALL
SELECT 'poll_log table ready ✅';
