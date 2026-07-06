-- Saved schedules table — run this once in the Supabase SQL Editor.
--
-- The backend accesses this table with the service-role key, which bypasses
-- Row Level Security. Ownership enforcement (user_id == JWT sub) happens in
-- routes/schedule.py, so no RLS policies are defined here on purpose; RLS is
-- enabled only so the anon/publishable key cannot read or write the table.

CREATE TABLE IF NOT EXISTS saved_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  semester TEXT NOT NULL,
  courses JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE saved_schedules ENABLE ROW LEVEL SECURITY;
