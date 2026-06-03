-- Learning Paths Feature - Manual Database Migration
-- Run this SQL script directly in your PostgreSQL database

-- Step 1: Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS learning_path TEXT,
ADD COLUMN IF NOT EXISTS last_practice_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS bootcamp_start_date TIMESTAMP;

-- Step 2: Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  requirement INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 3: Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id VARCHAR NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, achievement_id)
);

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- Verify the changes
SELECT 'Migration completed successfully!' AS status;

-- Show table structure
\d users
\d achievements
\d user_achievements
