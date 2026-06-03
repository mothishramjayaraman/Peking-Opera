//blueprint for database tables and validation
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").unique(),
  googleId: text("google_id").unique(),
  experienceLevel: text("experience_level").notNull(),
  vocalRange: text("vocal_range"),
  learningPath: text("learning_path"),
  currentPhase: integer("current_phase").notNull().default(1),
  totalPracticeMinutes: integer("total_practice_minutes").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastPracticeDate: timestamp("last_practice_date"),
  bootcampStartDate: timestamp("bootcamp_start_date"),
  weeklyGoalMinutes: integer("weekly_goal_minutes").notNull().default(60),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  password: text("password"),
});

export const exercises = pgTable("exercises", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  phase: integer("phase").notNull(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  instructions: text("instructions").notNull(),
  targetMetrics: jsonb("target_metrics"),
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
});

export const exerciseProgress = pgTable("exercise_progress", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  exerciseId: varchar("exercise_id").notNull().references(() => exercises.id),
  completed: boolean("completed").notNull().default(false),
  pitchScore: real("pitch_score"),
  toneScore: real("tone_score"),
  breathingScore: real("breathing_score"),
  overallScore: real("overall_score"),
  completedAt: timestamp("completed_at"),
  feedback: text("feedback"),
  generativeFeedback: text("generative_feedback"),
});

export const insertExerciseProgressSchema = createInsertSchema(
  exerciseProgress
).omit({
  id: true,
});

export const voiceAnalysis = pgTable("voice_analysis", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  exerciseId: varchar("exercise_id"),
  audioUrl: text("audio_url"),
  pitchAccuracy: real("pitch_accuracy").notNull(),
  toneStability: real("tone_stability").notNull(),
  breathingConsistency: real("breathing_consistency").notNull(),
  overallRating: real("overall_rating").notNull(),
  suggestions: jsonb("suggestions").notNull(),
  generativeFeedback: text("generative_feedback"),
  analyzedAt: text("analyzed_at").notNull(),
});

export const insertVoiceAnalysisSchema = createInsertSchema(voiceAnalysis).omit(
  {
    id: true,
  }
);

export const songs = pgTable("songs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  genre: text("genre").notNull(),
  difficulty: text("difficulty").notNull(),
  vocalRange: text("vocal_range").notNull(),
  bpm: integer("bpm").notNull(),
  key: text("key").notNull(),
  lyrics: text("lyrics"),
  lyricsTimestamps: jsonb("lyrics_timestamps"),
  audioUrl: text("audio_url"),
  phase: integer("phase"),
});

export const insertSongSchema = createInsertSchema(songs).omit({
  id: true,
});

export const practiceRoutines = pgTable("practice_routines", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  exerciseIds: jsonb("exercise_ids").notNull(),
  goalMinutes: integer("goal_minutes").notNull(),
  completedMinutes: integer("completed_minutes").notNull().default(0),
});

export const insertPracticeRoutineSchema = createInsertSchema(
  practiceRoutines
).omit({
  id: true,
});

export const performances = pgTable("performances", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  songId: varchar("song_id").references(() => songs.id),
  audienceReactions: jsonb("audience_reactions"),
  performanceScore: real("performance_score"),
  stageEffects: jsonb("stage_effects"),
  performedAt: text("performed_at").notNull(),
});

export const insertPerformanceSchema = createInsertSchema(performances).omit({
  id: true,
});



