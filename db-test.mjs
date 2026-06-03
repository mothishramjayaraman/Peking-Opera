import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./shared/schema.js";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log("--- READ: All Users ---");
  const users = await db.select().from(schema.users);
  console.log(users.length ? users : "No users yet.");

  console.log("\n--- READ: All Exercises ---");
  const exercises = await db.select().from(schema.exercises);
  console.log(exercises.length ? exercises.map(e => `[${e.id}] ${e.title} (Phase ${e.phase})`) : "No exercises yet.");

  console.log("\n--- CREATE: Insert test user ---");
  const inserted = await db.insert(schema.users).values({
    username: "db_test_user",
    email: "dbtest@singsmart.com",
    passwordHash: "not_a_real_hash",
    experienceLevel: "beginner",
    currentPhase: 1,
  }).returning();
  console.log("Inserted:", inserted[0]);

  const newUserId = inserted[0].id;

  console.log("\n--- UPDATE: Change experience level ---");
  const updated = await db.update(schema.users)
    .set({ experienceLevel: "intermediate", currentPhase: 2 })
    .where(eq(schema.users.id, newUserId))
    .returning();
  console.log("Updated:", updated[0]);

  console.log("\n--- DELETE: Remove test user ---");
  await db.delete(schema.users).where(eq(schema.users.id, newUserId));
  console.log("Deleted user id:", newUserId);

  console.log("\n--- READ: Users after delete ---");
  const finalUsers = await db.select().from(schema.users);
  console.log(finalUsers.length ? finalUsers : "No users.");

  await pool.end();
}

main().catch(console.error);
