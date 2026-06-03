import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { db } from "./db.js";
import { eq, and, desc, sql } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import {
  phase1Exercises,
  phase2Exercises,
  phase3Exercises,
  songsData
} from "./seed-data.js";

// Returns the difference in local calendar days between two Date objects.
// Both dates are floored to local midnight so time-of-day never affects the result.
function localDaysBetween(earlier, later) {
  const a = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((b - a) / 86_400_000);
}

export class MemStorage {
  constructor() {
    this.users = new Map();
    this.exercises = new Map();
    this.exerciseProgress = new Map();
    this.voiceAnalyses = new Map();
    this.songs = new Map();
    this.practiceRoutines = new Map();
    this.performances = new Map();
    this.dataFile = path.resolve(process.cwd(), "data.json");

    this.loadData();
    if (this.users.size === 0 && this.exercises.size === 0) {
      this.seedData();
    }
  }

  loadData() {
    if (fs.existsSync(this.dataFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.dataFile, "utf-8"));
        Object.entries(data.users || {}).forEach(([k, v]) => this.users.set(k, v));
        Object.entries(data.exercises || {}).forEach(([k, v]) => this.exercises.set(k, v));
        Object.entries(data.exerciseProgress || {}).forEach(([k, v]) => this.exerciseProgress.set(k, v));
        Object.entries(data.voiceAnalyses || {}).forEach(([k, v]) => this.voiceAnalyses.set(k, v));
        Object.entries(data.songs || {}).forEach(([k, v]) => this.songs.set(k, v));
        Object.entries(data.practiceRoutines || {}).forEach(([k, v]) => this.practiceRoutines.set(k, v));
        Object.entries(data.performances || {}).forEach(([k, v]) => this.performances.set(k, v));
        this._patchExerciseTargetMetrics();
      } catch (e) {
        console.error("Failed to load data:", e);
      }
    }
  }

  _patchExerciseTargetMetrics() {
    const nameMap = {
      "Siren Slide": ["pitch", "tone"],
      "Tongue Twister Warmup": ["tone"],
      "Chest Voice Explorer": ["tone"],
      "Jaw Relaxation": ["tone"],
      "Basic Microphone Stance": ["expression"],
      "First Melody Line": ["pitch", "tone"],
      "Intense Vocal Staccato": ["pitch", "breathing"],
      "Resonance Focus Drill": ["tone"],
      "Chest Voice vs Head Voice": ["pitch", "tone"],
      "Dynamics Control": ["tone", "breathing"],
      "Style Exploration": ["tone", "expression"],
      "Nasal Resonance Drill": ["tone"],
      "Vocal Fry Transition": ["tone", "breathing"],
      "Agility Scales": ["pitch"],
      "Mixed Voice Prep": ["pitch", "tone"],
      "Mixed Voice Discovery": ["pitch", "tone"],
      "Lyric Interpretation": ["expression"],
      "Dynamic Shifts in Song": ["tone", "expression"],
      "Stage Presence": ["expression"],
      "Performance Run-Through": ["pitch", "tone", "breathing", "vibrato", "expression"],
      "Microphone Technique": ["tone", "breathing"],
      "Recovery Techniques": ["expression"],
      "Virtual Audience Interaction": ["expression"],
      "Stage Movement Drills": ["breathing", "expression"],
      "Stress Response Mastery": ["breathing", "expression"],
      "Multi-Style Medley": ["pitch", "tone", "expression"],
      "Belt Technique Basics": ["tone", "breathing"],
      "Subtle Vocal Runs": ["pitch", "vibrato"],
      "In-Ear Monitor Simulation": ["pitch", "tone"],
      "Vibrato Control": ["vibrato"],
      "Intervals & Accuracy": ["pitch"],
      "Phrasing Logic": ["breathing", "expression"],
    };
    const categoryDefaults = {
      warmup: ["pitch", "tone"],
      technique: ["pitch", "tone"],
      performance: ["expression"],
    };
    let changed = false;
    this.exercises.forEach((exercise, id) => {
      if (!exercise.targetMetrics || exercise.targetMetrics.length === 0) {
        const metrics = nameMap[exercise.name] || categoryDefaults[exercise.category] || ["pitch", "tone"];
        this.exercises.set(id, { ...exercise, targetMetrics: metrics });
        changed = true;
      }
    });
    if (changed) this.saveData();
  }

  saveData() {
    const data = {
      users: Object.fromEntries(this.users),
      exercises: Object.fromEntries(this.exercises),
      exerciseProgress: Object.fromEntries(this.exerciseProgress),
      voiceAnalyses: Object.fromEntries(this.voiceAnalyses),
      songs: Object.fromEntries(this.songs),
      practiceRoutines: Object.fromEntries(this.practiceRoutines),
      performances: Object.fromEntries(this.performances),
    };
    fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
  }

  seedData() {
    // Seed exercises
    [...phase1Exercises, ...phase2Exercises, ...phase3Exercises].forEach((exercise) => {
      const id = randomUUID();
      this.exercises.set(id, { ...exercise, id });
    });

    // Seed songs
    songsData.forEach((song) => {
      const id = randomUUID();
      this.songs.set(id, {
        ...song,
        id,
        phase: song.phase ?? null,
        lyrics: song.lyrics ?? null
      });
    });
    
    this.saveData();
  }

  async getUser(id) {
    return this.users.get(id);
  }

  async getUserByUsername(username) {
    return Array.from(this.users.values()).find((user) => user.name === username);
  }

  async getUserByEmail(email) {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }

  async getUserByGoogleId(googleId) {
    return Array.from(this.users.values()).find((user) => user.googleId === googleId);
  }

  async getFirstUser() {
    const users = Array.from(this.users.values());
    return users[0];
  }

  async createUser(insertUser) {
    const id = randomUUID();
    const startingPhase =
      insertUser.experienceLevel === "advanced" ? 3 :
        insertUser.experienceLevel === "intermediate" ? 2 : 1;

    const user = {
      id,
      name: insertUser.name,
      email: insertUser.email || null,
      googleId: insertUser.googleId || null,
      password: insertUser.password || null,
      experienceLevel: insertUser.experienceLevel,
      vocalRange: insertUser.vocalRange || null,
      learningPath: null,
      currentPhase: startingPhase,
      totalPracticeMinutes: 0,
      streak: 0,
      lastPracticeDate: null,
      bootcampStartDate: null,
      weeklyGoalMinutes: 60,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    this.saveData();
    return user;
  }

  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    this.saveData();
    return updatedUser;
  }

  async updateStreak(userId) {
    const user = this.users.get(userId);
    if (!user) return;

    const now = new Date();
    let newStreak = user.streak || 0;

    if (!user.lastPracticeDate) {
      newStreak = 1;
    } else {
      const diffDays = localDaysBetween(new Date(user.lastPracticeDate), now);
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
      // diffDays === 0: same calendar day, streak unchanged
    }

    return await this.updateUser(userId, {
      streak: newStreak,
      lastPracticeDate: now,
    });
  }

  async resetUserProgress(id) {
    const user = this.users.get(id);
    if (!user) return undefined;

    this.exerciseProgress.forEach((p, pid) => {
      if (p.userId === id) this.exerciseProgress.delete(pid);
    });

    this.performances.forEach((p, pid) => {
      if (p.userId === id) this.performances.delete(pid);
    });

    this.voiceAnalyses.forEach((a, aid) => {
      if (a.userId === id) this.voiceAnalyses.delete(aid);
    });

    this.practiceRoutines.forEach((r, rid) => {
      if (r.userId === id) this.practiceRoutines.delete(rid);
    });

    const resetUser = {
      ...user,
      currentPhase: 1,
      totalPracticeMinutes: 0,
      streak: 0,
      learningPath: null,
      lastPracticeDate: null,
    };
    this.users.set(id, resetUser);

    this.saveData();
    return resetUser;
  }

  async getExercises() {
    return Array.from(this.exercises.values());
  }

  async getExercisesByPhase(phase) {
    return Array.from(this.exercises.values()).filter(e => e.phase === phase);
  }

  async getExercise(id) {
    return this.exercises.get(id);
  }

  async createExercise(exercise) {
    const id = randomUUID();
    const newExercise = { ...exercise, id };
    this.exercises.set(id, newExercise);
    this.saveData();
    return newExercise;
  }

  async updateExercise(id, updates) {
    const exercise = this.exercises.get(id);
    if (!exercise) return undefined;
    const updated = { ...exercise, ...updates };
    this.exercises.set(id, updated);
    this.saveData();
    return updated;
  }

  async deleteExercise(id) {
    const existed = this.exercises.has(id);
    this.exercises.delete(id);
    if (existed) this.saveData();
    return existed;
  }

  async getExerciseProgress(userId) {
    return Array.from(this.exerciseProgress.values()).filter(p => p.userId === userId);
  }

  async getExerciseProgressByExercise(userId, exerciseId) {
    return Array.from(this.exerciseProgress.values()).find(
      p => p.userId === userId && p.exerciseId === exerciseId
    );
  }

  async createExerciseProgress(progress) {
    const sanitizeScore = (val) => {
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const id = randomUUID();
    const newProgress = {
      id,
      userId: progress.userId,
      exerciseId: progress.exerciseId,
      completed: progress.completed ?? false,
      pitchScore: sanitizeScore(progress.pitchScore),
      toneScore: sanitizeScore(progress.toneScore),
      breathingScore: sanitizeScore(progress.breathingScore),
      overallScore: sanitizeScore(progress.overallScore),
      completedAt: progress.completedAt ?? null,
      feedback: progress.feedback ?? null,
      generativeFeedback: progress.generativeFeedback ?? null,
    };
    this.exerciseProgress.set(id, newProgress);
    this.saveData();
    return newProgress;
  }

  async updateExerciseProgress(id, updates) {
    const progress = this.exerciseProgress.get(id);
    if (!progress) return undefined;

    const sanitizeScore = (val) => {
      if (val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const sanitizedUpdates = { ...updates };
    if (updates.pitchScore !== undefined) sanitizedUpdates.pitchScore = sanitizeScore(updates.pitchScore);
    if (updates.toneScore !== undefined) sanitizedUpdates.toneScore = sanitizeScore(updates.toneScore);
    if (updates.breathingScore !== undefined) sanitizedUpdates.breathingScore = sanitizeScore(updates.breathingScore);
    if (updates.overallScore !== undefined) sanitizedUpdates.overallScore = sanitizeScore(updates.overallScore);

    const updatedProgress = { ...progress, ...sanitizedUpdates };
    this.exerciseProgress.set(id, updatedProgress);
    this.saveData();
    return updatedProgress;
  }

  async deleteExerciseProgress(id) {
    const existed = this.exerciseProgress.has(id);
    this.exerciseProgress.delete(id);
    if (existed) this.saveData();
    return existed;
  }

  async getVoiceAnalyses(userId) {
    return Array.from(this.voiceAnalyses.values()).filter(a => a.userId === userId);
  }

  async createVoiceAnalysis(analysis) {
    const id = randomUUID();
    const newAnalysis = {
      id,
      userId: analysis.userId,
      exerciseId: analysis.exerciseId ?? null,
      audioUrl: analysis.audioUrl ?? null,
      pitchAccuracy: analysis.pitchAccuracy,
      toneStability: analysis.toneStability,
      breathingConsistency: analysis.breathingConsistency,
      overallRating: analysis.overallRating,
      suggestions: analysis.suggestions,
      generativeFeedback: analysis.generativeFeedback ?? null,
      analyzedAt: analysis.analyzedAt,
    };
    this.voiceAnalyses.set(id, newAnalysis);
    this.saveData();
    return newAnalysis;
  }

  async updateVoiceAnalysis(id, updates) {
    const analysis = this.voiceAnalyses.get(id);
    if (!analysis) return undefined;
    const updated = { ...analysis, ...updates };
    this.voiceAnalyses.set(id, updated);
    this.saveData();
    return updated;
  }

  async deleteVoiceAnalysis(id) {
    const existed = this.voiceAnalyses.has(id);
    this.voiceAnalyses.delete(id);
    if (existed) this.saveData();
    return existed;
  }

  async getSongs() {
    return Array.from(this.songs.values());
  }

  async getSongsByVocalRange(vocalRange) {
    return Array.from(this.songs.values()).filter(
      s => s.vocalRange?.toLowerCase() === vocalRange?.toLowerCase()
    );
  }

  async getSong(id) {
    return this.songs.get(id);
  }

  async createSong(song) {
    const id = randomUUID();
    const newSong = {
      ...song,
      id,
      phase: song.phase ?? null,
      lyrics: song.lyrics ?? null
    };
    this.songs.set(id, newSong);
    this.saveData();
    return newSong;
  }

  async updateSong(id, updates) {
    const song = this.songs.get(id);
    if (!song) return undefined;
    const updated = { ...song, ...updates };
    this.songs.set(id, updated);
    this.saveData();
    return updated;
  }

  async deleteSong(id) {
    const existed = this.songs.has(id);
    this.songs.delete(id);
    if (existed) this.saveData();
    return existed;
  }

  async getPracticeRoutine(userId) {
    return Array.from(this.practiceRoutines.values()).find(
      r => r.userId === userId
    );
  }

  async getPracticeRoutines(userId) {
    return Array.from(this.practiceRoutines.values()).filter(
      r => r.userId === userId
    );
  }

  async createPracticeRoutine(routine) {
    const id = randomUUID();
    const newRoutine = {
      id,
      userId: routine.userId,
      exerciseIds: routine.exerciseIds,
      goalMinutes: routine.goalMinutes,
      completedMinutes: routine.completedMinutes ?? 0,
    };
    this.practiceRoutines.set(id, newRoutine);
    this.saveData();
    return newRoutine;
  }

  async updatePracticeRoutine(id, updates) {
    const routine = this.practiceRoutines.get(id);
    if (!routine) return undefined;

    const updatedRoutine = { ...routine, ...updates };
    this.practiceRoutines.set(id, updatedRoutine);
    this.saveData();
    return updatedRoutine;
  }

  async deletePracticeRoutine(id) {
    const existed = this.practiceRoutines.has(id);
    this.practiceRoutines.delete(id);
    if (existed) this.saveData();
    return existed;
  }

  async getPerformances(userId) {
    return Array.from(this.performances.values()).filter(
      (p) => p.userId === userId
    );
  }

  async createPerformance(performance) {
    const id = randomUUID();
    const newPerformance = {
      id,
      userId: performance.userId,
      songId: performance.songId ?? null,
      audienceReactions: performance.audienceReactions ?? null,
      performanceScore: performance.performanceScore ?? null,
      stageEffects: performance.stageEffects ?? null,
      performedAt: performance.performedAt,
    };
    this.performances.set(id, newPerformance);
    this.saveData();
    return newPerformance;
  }

  async updatePerformance(id, updates) {
    const performance = this.performances.get(id);
    if (!performance) return undefined;
    const updated = { ...performance, ...updates };
    this.performances.set(id, updated);
    this.saveData();
    return updated;
  }

  async deletePerformance(id) {
    const existed = this.performances.has(id);
    this.performances.delete(id);
    if (existed) this.saveData();
    return existed;
  }

  async deleteUser(id) {
    const existed = this.users.has(id);
    this.users.delete(id);
    if (existed) this.saveData();
    return existed;
  }

  async getPracticeSessionCount(userId) {
    return Array.from(this.exerciseProgress.values())
      .filter(p => p.userId === userId).length;
  }

  async getChallengeCompletionCount(userId) {
    return 0; // Feature removed
  }

  async getCompletedExerciseIds(userId) {
    return Array.from(this.exerciseProgress.values())
      .filter(p => p.userId === userId && p.completed)
      .map(p => p.exerciseId);
  }

  async getExercisesByCategory(category) {
    return Array.from(this.exercises.values())
      .filter(e => e.category === category);
  }
}

export class DatabaseStorage {
  constructor() {
    this.seedAll().catch(err => console.error("Failed to seed database:", err));
  }

  async seedAll() {
    await this.seedExercises();
    await this.seedSongs();
  }



  async seedExercises() {
    try {
      const existing = await db.select().from(schema.exercises);
      if (existing.length > 0) return;

      const exercises = [...phase1Exercises, ...phase2Exercises, ...phase3Exercises];
      await db.insert(schema.exercises).values(exercises.map(e => ({
        ...e,
        id: randomUUID(),
      })));
    } catch (error) {
      console.error("Exercise seeding error:", error);
    }
  }

  async seedSongs() {
    try {
      const existing = await db.select().from(schema.songs);
      if (existing.length > 0) return;

      await db.insert(schema.songs).values(songsData.map(s => ({
        ...s,
        id: randomUUID(),
        phase: s.phase ?? null,
        lyrics: s.lyrics ?? null
      })));
    } catch (error) {
      console.error("Song seeding error:", error);
    }
  }

  async getUser(id) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.name, username));
    return user;
  }

  async getUserByEmail(email) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async getUserByGoogleId(googleId) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.googleId, googleId));
    return user;
  }

  async getFirstUser() {
    const [user] = await db.select().from(schema.users).limit(1);
    return user;
  }

  async createUser(insertUser) {
    const startingPhase =
      insertUser.experienceLevel === "advanced" ? 3 :
        insertUser.experienceLevel === "intermediate" ? 2 : 1;

    const [user] = await db.insert(schema.users).values({
      id: randomUUID(),
      name: insertUser.name,
      email: insertUser.email || null,
      googleId: insertUser.googleId || null,
      password: insertUser.password || null,
      experienceLevel: insertUser.experienceLevel,
      vocalRange: insertUser.vocalRange || null,
      currentPhase: startingPhase,
      totalPracticeMinutes: 0,
      streak: 0,
      weeklyGoalMinutes: 60,
    }).returning();
    return user;
  }

  async updateUser(id, updates) {
    const [updated] = await db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, id))
      .returning();
    return updated;
  }

  async updateStreak(userId) {
    const user = await this.getUser(userId);
    if (!user) return;

    const now = new Date();
    let newStreak = user.streak || 0;

    if (!user.lastPracticeDate) {
      newStreak = 1;
    } else {
      const diffDays = localDaysBetween(new Date(user.lastPracticeDate), now);
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
      // diffDays === 0: same calendar day, streak unchanged
    }

    return await this.updateUser(userId, {
      streak: newStreak,
      lastPracticeDate: now,
    });
  }

  async resetUserProgress(id) {
    await db.delete(schema.exerciseProgress).where(eq(schema.exerciseProgress.userId, id));
    await db.delete(schema.performances).where(eq(schema.performances.userId, id));
    await db.delete(schema.practiceRoutines).where(eq(schema.practiceRoutines.userId, id));
    await db.delete(schema.voiceAnalysis).where(eq(schema.voiceAnalysis.userId, id));

    const [user] = await db
      .update(schema.users)
      .set({
        currentPhase: 1,
        totalPracticeMinutes: 0,
        streak: 0,
        learningPath: null,
        lastPracticeDate: null,
      })
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }

  async getExercises() {
    return await db.select().from(schema.exercises);
  }

  async getExercisesByPhase(phase) {
    return await db.select().from(schema.exercises).where(eq(schema.exercises.phase, phase));
  }

  async getExercise(id) {
    const [exercise] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, id));
    return exercise;
  }

  async createExercise(exercise) {
    const [newExercise] = await db.insert(schema.exercises).values({
      ...exercise,
      id: randomUUID(),
    }).returning();
    return newExercise;
  }

  async updateExercise(id, updates) {
    const [updated] = await db
      .update(schema.exercises)
      .set(updates)
      .where(eq(schema.exercises.id, id))
      .returning();
    return updated;
  }

  async deleteExercise(id) {
    const result = await db.delete(schema.exercises).where(eq(schema.exercises.id, id)).returning();
    return result.length > 0;
  }

  async getExerciseProgress(userId) {
    return await db.select().from(schema.exerciseProgress).where(eq(schema.exerciseProgress.userId, userId));
  }

  async getExerciseProgressByExercise(userId, exerciseId) {
    const [progress] = await db
      .select()
      .from(schema.exerciseProgress)
      .where(
        and(
          eq(schema.exerciseProgress.userId, userId),
          eq(schema.exerciseProgress.exerciseId, exerciseId)
        )
      );
    return progress;
  }

  async createExerciseProgress(progress) {
    const sanitizeScore = (val) => {
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const [newProgress] = await db.insert(schema.exerciseProgress).values({
      ...progress,
      id: randomUUID(),
      completed: progress.completed ?? false,
      pitchScore: sanitizeScore(progress.pitchScore),
      toneScore: sanitizeScore(progress.toneScore),
      breathingScore: sanitizeScore(progress.breathingScore),
      overallScore: sanitizeScore(progress.overallScore),
      generativeFeedback: progress.generativeFeedback ?? null,
    }).returning();
    return newProgress;
  }

  async updateExerciseProgress(id, updates) {
    const sanitizeScore = (val) => {
      if (val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const sanitizedUpdates = { ...updates };
    if (updates.pitchScore !== undefined) sanitizedUpdates.pitchScore = sanitizeScore(updates.pitchScore);
    if (updates.toneScore !== undefined) sanitizedUpdates.toneScore = sanitizeScore(updates.toneScore);
    if (updates.breathingScore !== undefined) sanitizedUpdates.breathingScore = sanitizeScore(updates.breathingScore);
    if (updates.overallScore !== undefined) sanitizedUpdates.overallScore = sanitizeScore(updates.overallScore);

    const [updated] = await db
      .update(schema.exerciseProgress)
      .set(sanitizedUpdates)
      .where(eq(schema.exerciseProgress.id, id))
      .returning();
    return updated;
  }

  async deleteExerciseProgress(id) {
    const result = await db.delete(schema.exerciseProgress).where(eq(schema.exerciseProgress.id, id)).returning();
    return result.length > 0;
  }

  async getVoiceAnalyses(userId) {
    return await db.select().from(schema.voiceAnalysis).where(eq(schema.voiceAnalysis.userId, userId));
  }

  async createVoiceAnalysis(analysis) {
    const [newAnalysis] = await db.insert(schema.voiceAnalysis).values({
      ...analysis,
      id: randomUUID(),
      exerciseId: analysis.exerciseId ?? null,
      audioUrl: analysis.audioUrl ?? null,
    }).returning();
    return newAnalysis;
  }

  async updateVoiceAnalysis(id, updates) {
    const [updated] = await db
      .update(schema.voiceAnalysis)
      .set(updates)
      .where(eq(schema.voiceAnalysis.id, id))
      .returning();
    return updated;
  }

  async deleteVoiceAnalysis(id) {
    const result = await db.delete(schema.voiceAnalysis).where(eq(schema.voiceAnalysis.id, id)).returning();
    return result.length > 0;
  }

  async getSongs() {
    return await db.select().from(schema.songs);
  }

  async getSongsByVocalRange(vocalRange) {
    return await db
      .select()
      .from(schema.songs)
      .where(sql`LOWER(${schema.songs.vocalRange}) = LOWER(${vocalRange})`);
  }

  async getSong(id) {
    const [song] = await db.select().from(schema.songs).where(eq(schema.songs.id, id));
    return song;
  }

  async createSong(song) {
    const [newSong] = await db.insert(schema.songs).values({
      ...song,
      id: randomUUID(),
      phase: song.phase ?? null,
      lyrics: song.lyrics ?? null
    }).returning();
    return newSong;
  }

  async updateSong(id, updates) {
    const [updated] = await db
      .update(schema.songs)
      .set(updates)
      .where(eq(schema.songs.id, id))
      .returning();
    return updated;
  }

  async deleteSong(id) {
    const result = await db.delete(schema.songs).where(eq(schema.songs.id, id)).returning();
    return result.length > 0;
  }

  async getPracticeRoutine(userId) {
    const [routine] = await db.select().from(schema.practiceRoutines).where(eq(schema.practiceRoutines.userId, userId));
    return routine;
  }

  async getPracticeRoutines(userId) {
    return await db.select().from(schema.practiceRoutines).where(eq(schema.practiceRoutines.userId, userId));
  }

  async createPracticeRoutine(routine) {
    const [newRoutine] = await db.insert(schema.practiceRoutines).values({
      ...routine,
      id: randomUUID(),
      completedMinutes: routine.completedMinutes ?? 0,
    }).returning();
    return newRoutine;
  }

  async updatePracticeRoutine(id, updates) {
    const [updated] = await db
      .update(schema.practiceRoutines)
      .set(updates)
      .where(eq(schema.practiceRoutines.id, id))
      .returning();
    return updated;
  }

  async deletePracticeRoutine(id) {
    const result = await db.delete(schema.practiceRoutines).where(eq(schema.practiceRoutines.id, id)).returning();
    return result.length > 0;
  }

  async getPerformances(userId) {
    return await db.select().from(schema.performances).where(eq(schema.performances.userId, userId));
  }

  async createPerformance(performance) {
    const [newPerformance] = await db.insert(schema.performances).values({
      ...performance,
      id: randomUUID(),
    }).returning();
    return newPerformance;
  }

  async updatePerformance(id, updates) {
    const [updated] = await db
      .update(schema.performances)
      .set(updates)
      .where(eq(schema.performances.id, id))
      .returning();
    return updated;
  }

  async deletePerformance(id) {
    const result = await db.delete(schema.performances).where(eq(schema.performances.id, id)).returning();
    return result.length > 0;
  }

  async deleteUser(id) {
    const result = await db.delete(schema.users).where(eq(schema.users.id, id)).returning();
    return result.length > 0;
  }

  async getPracticeSessionCount(userId) {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(schema.exerciseProgress)
      .where(eq(schema.exerciseProgress.userId, userId));
    return Number(result[0]?.count || 0);
  }

  async getChallengeCompletionCount(userId) {
    return 0; // Feature removed
  }

  async getCompletedExerciseIds(userId) {
    const progress = await db
      .select({ exerciseId: schema.exerciseProgress.exerciseId })
      .from(schema.exerciseProgress)
      .where(and(
        eq(schema.exerciseProgress.userId, userId),
        eq(schema.exerciseProgress.completed, true)
      ));
    return progress.map(p => p.exerciseId);
  }

  async getExercisesByCategory(category) {
    return await db.select().from(schema.exercises)
      .where(eq(schema.exercises.category, category));
  }
}

const isDatabase = !!process.env.DATABASE_URL;
console.log(`[STORAGE] Initializing storage mode: ${isDatabase ? "Database (PostgreSQL)" : "Memory (Map)"}`);

export const storage = isDatabase ? new DatabaseStorage() : new MemStorage();
