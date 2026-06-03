import { drizzle } from "drizzle-orm/node-postgres"; // 
import pg from "pg"; // 
import * as schema from "../shared/schema.js"; 
import dotenv from "dotenv"; // Loads env variables from .env file

dotenv.config(); // Initialize env variables

// Ensure DATABASE_URL exists in production (warn instead of crash for MemStorage fallback)
if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production") {
    console.warn("[WARNING] DATABASE_URL is not set. Falling back to MemStorage in production.");
  }
}

// pool = a collection of reusable database connections.

// Create PostgreSQL connection pool



export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // DB connection string
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false } // Allow SSL in production (common for hosted DBs)
      : false, // No SSL locally
});

// Initialize Drizzle ORM with schema + pool
export const db = drizzle(pool, { schema });
