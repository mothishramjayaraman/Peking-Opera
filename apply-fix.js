import { pool } from "./server/db.js";

async function applyFix() {
  console.log("Adding target_metrics column...");
  try {
    await pool.query('ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "target_metrics" jsonb;');
    console.log("Column added or already exists.");
  } catch (error) {
    console.error("Failed to add column:", error);
  } finally {
    await pool.end();
  }
}

applyFix();
