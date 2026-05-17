-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- TABLES
-- =====================

-- Bead colors reference table
CREATE TABLE IF NOT EXISTS bead_colors (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hex TEXT NOT NULL,
  series TEXT NOT NULL
);

-- User inventory
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color_code TEXT NOT NULL REFERENCES bead_colors(code),
  quantity INTEGER NOT NULL DEFAULT 0,
  low_threshold INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, color_code)
);

-- Patterns
CREATE TABLE IF NOT EXISTS patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pattern beads (bead usage per pattern)
CREATE TABLE IF NOT EXISTS pattern_beads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  color_code TEXT NOT NULL REFERENCES bead_colors(code),
  quantity INTEGER NOT NULL DEFAULT 0
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_patterns_user_id ON patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON patterns(status);
CREATE INDEX IF NOT EXISTS idx_pattern_beads_pattern_id ON pattern_beads(pattern_id);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE bead_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_beads ENABLE ROW LEVEL SECURITY;

-- bead_colors: everyone can read
CREATE POLICY "bead_colors_public_read" ON bead_colors
  FOR SELECT USING (true);

-- inventory: users can only access their own
CREATE POLICY "inventory_user_select" ON inventory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "inventory_user_insert" ON inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "inventory_user_update" ON inventory
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "inventory_user_delete" ON inventory
  FOR DELETE USING (auth.uid() = user_id);

-- patterns: users can only access their own
CREATE POLICY "patterns_user_select" ON patterns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "patterns_user_insert" ON patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "patterns_user_update" ON patterns
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "patterns_user_delete" ON patterns
  FOR DELETE USING (auth.uid() = user_id);

-- pattern_beads: accessible if user owns the parent pattern
CREATE POLICY "pattern_beads_user_select" ON pattern_beads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patterns
      WHERE patterns.id = pattern_beads.pattern_id
        AND patterns.user_id = auth.uid()
    )
  );

CREATE POLICY "pattern_beads_user_insert" ON pattern_beads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patterns
      WHERE patterns.id = pattern_beads.pattern_id
        AND patterns.user_id = auth.uid()
    )
  );

CREATE POLICY "pattern_beads_user_delete" ON pattern_beads
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM patterns
      WHERE patterns.id = pattern_beads.pattern_id
        AND patterns.user_id = auth.uid()
    )
  );

-- =====================
-- STORAGE BUCKET
-- =====================
INSERT INTO storage.buckets (id, name, public)
VALUES ('pattern-images', 'pattern-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "pattern_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'pattern-images');

CREATE POLICY "pattern_images_user_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pattern-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "pattern_images_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pattern-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- Seed data is in 002_seed_colors.sql
