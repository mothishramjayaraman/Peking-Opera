import { storage } from "./storage.js";

async function seed() {
  console.log("Starting database seeding...");
  
  if (storage.seedAll) {
    try {
      await storage.seedAll();
      console.log("Database seeding completed successfully.");
    } catch (error) {
      console.error("Error during seeding:", error);
      process.exit(1);
    }
  } else {
    console.log("Storage does not support seedAll (likely using MemStorage or already logic in constructor).");
  }
  
  process.exit(0);
}

seed();
