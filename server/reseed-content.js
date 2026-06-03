// Run once to replace old exercises and songs with 京剧 content.
// Preserves all users, progress, and performance history.
// Usage: node server/reseed-content.js

import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import {
  phase1Exercises,
  phase2Exercises,
  phase3Exercises,
  songsData,
} from "./seed-data.js";

const dataFile = path.resolve(process.cwd(), "data.json");

// Load existing data (preserves users, progress, performances)
let data = {};
if (fs.existsSync(dataFile)) {
  data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
  console.log(`Loaded existing data.json (${Object.keys(data.users || {}).length} users preserved).`);
} else {
  console.log("No data.json found — creating fresh.");
}

// Replace exercises
const exercises = {};
[...phase1Exercises, ...phase2Exercises, ...phase3Exercises].forEach((exercise) => {
  const id = randomUUID();
  exercises[id] = { ...exercise, id };
});

// Replace songs
const songs = {};
songsData.forEach((song) => {
  const id = randomUUID();
  songs[id] = { ...song, id, phase: song.phase ?? null, lyrics: song.lyrics ?? null };
});

data.exercises = exercises;
data.songs = songs;

fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

console.log(`Done. Reseeded ${Object.keys(exercises).length} exercises and ${Object.keys(songs).length} songs into data.json.`);
