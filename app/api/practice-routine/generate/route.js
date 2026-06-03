import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../../server/storage.js";

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedGoal = body.goalMinutes;
    const focusAreas = body.focusAreas;

    const user = await storage.getUser(userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const goalMinutes = requestedGoal || 30;
    const phase = user.currentPhase || 1;
    const allExercises = await storage.getExercises();
    const progress = await storage.getExerciseProgress(userId);
    
    //keeps exercise belong to user phase
    const currentPhaseExercises = allExercises.filter(e => e.phase === phase);
    
    if (currentPhaseExercises.length === 0) {
      return NextResponse.json({ message: "No exercises found for current phase" }, { status: 404 });
    }

    // Adaptive logic: prioritize exercises with no progress or low scores
    const isAdaptive = user.learningPath === "adaptive";
    const scoreMap = new Map();
    progress.forEach(p => {
      if (p.overallScore !== null) {//exercise with score are set
        scoreMap.set(p.exerciseId, p.overallScore);
      }
    });
    //focusArea filtering 
    const categories = ["warmup", "technique", "performance"];
    const filteredCategories = focusAreas && focusAreas.length > 0 
      ? categories.filter(c => focusAreas.includes(c))
      : categories;

    // Path Differentiation Logic
    const learningPath = user.learningPath || "structured";

    // 1. Time distribution (weights)
    let weights = {
      warmup: 0.2,
      technique: 0.5,
      performance: 0.3
    };

    if (learningPath === "structured") {
      weights = { warmup: 0.25, technique: 0.55, performance: 0.20 };
    } else if (learningPath === "intensive") {
      weights = { warmup: 0.10, technique: 0.75, performance: 0.15 };
    } else if (learningPath === "flexible") {
      weights = { warmup: 0.33, technique: 0.33, performance: 0.34 };
    }

    //if the focus area is specified remaining weights are dropped
    let effectiveWeights = {};
    if (focusAreas && focusAreas.length > 0) {
      const totalWeight = filteredCategories.reduce((sum, c) => sum + (weights[c] || 0.3), 0);
      filteredCategories.forEach(c => {
        effectiveWeights[c] = (weights[c] || 0.3) / totalWeight;
      });
    } else {
      effectiveWeights = weights;
    }

    // 2. Exercise Pool Expansion for Flexible Path
    let exercisePool = currentPhaseExercises;
    if (learningPath === "flexible" && phase > 1) {
      exercisePool = allExercises.filter(e => e.phase <= phase);
    }

    const selectedExerciseIds = [];
    let currentTotalMinutes = 0;

    // Categorize exercises from the selected pool !!
    const exercisesByCat = {};
    categories.forEach(cat => {
      exercisesByCat[cat] = exercisePool.filter(e => e.category === cat);
    });

    const targets = {};
    for (const category of filteredCategories) {
      targets[category] = goalMinutes * effectiveWeights[category];
    }
    const availableExercises = [...exercisePool];
    
    // 3. Sorting logic for all paths
    availableExercises.sort((a, b) => {
      if (learningPath === "adaptive") {
        const scoreA = scoreMap.has(a.id) ? scoreMap.get(a.id) : -1;
        const scoreB = scoreMap.has(b.id) ? scoreMap.get(b.id) : -1;
        return scoreA - scoreB;
      } else if (learningPath === "structured") {
        const statusA = scoreMap.has(a.id) ? 1 : 0;
        const statusB = scoreMap.has(b.id) ? 1 : 0;
        if (statusA !== statusB) return statusA - statusB;
        const diffA = difficultyRank[a.difficulty] || 0;
        const diffB = difficultyRank[b.difficulty] || 0;
        if (diffA !== diffB) return diffA - diffB;
        return a.name.localeCompare(b.name);
      } else if (learningPath === "intensive") {
        return (difficultyRank[b.difficulty] || 0) - (difficultyRank[a.difficulty] || 0);
      } else if (learningPath === "flexible") {
        return 0.5 - Math.random();
      }
      return 0.5 - Math.random();
    });

    // Pass 1: Try to meet each category's strict target
    for (const category of filteredCategories) {
      let catCurrent = 0;
      for (const exercise of availableExercises) {
        if (exercise.category === category && !selectedExerciseIds.includes(exercise.id)) {
          const multiplier = learningPath === "intensive" ? 1.4 : 1.3;
          if (catCurrent + exercise.durationMinutes <= targets[category] * multiplier || catCurrent === 0) {
            selectedExerciseIds.push(exercise.id);
            catCurrent += exercise.durationMinutes;
            currentTotalMinutes += exercise.durationMinutes;
          }
          if (catCurrent >= targets[category]) break;
        }
      }
    }

    // Pass 2: If we are still below goalMinutes, fill remaining time from ANY requested category
    if (currentTotalMinutes < goalMinutes) {
      for (const exercise of availableExercises) {
        if (filteredCategories.includes(exercise.category) && !selectedExerciseIds.includes(exercise.id)) {
          // Allow slightly exceeding the total goal if we are close
          if (currentTotalMinutes + exercise.durationMinutes <= goalMinutes * 1.15 || currentTotalMinutes === 0) {
            selectedExerciseIds.push(exercise.id);
            currentTotalMinutes += exercise.durationMinutes;
          }
          if (currentTotalMinutes >= goalMinutes) break;
        }
      }
    }

    // Safety: ensure at least some exercises are selected if possible
    if (selectedExerciseIds.length === 0 && currentPhaseExercises.length > 0) {
      selectedExerciseIds.push(currentPhaseExercises[0].id);
    }
    
    const routine = await storage.createPracticeRoutine({
      userId,
      exerciseIds: selectedExerciseIds,
      goalMinutes: currentTotalMinutes, // Save the actual sum instead of the requested goal
      completedMinutes: 0,
    });

    // Enrich the response for immediate UI update
    const routineExercises = allExercises.filter(e => selectedExerciseIds.includes(e.id));
    const completedIds = progress
        .filter(p => p.completed && selectedExerciseIds.includes(p.exerciseId))
        .map(p => p.exerciseId);

    return NextResponse.json({
      ...routine,
      exercises: routineExercises,
      completedExercises: completedIds.length,
      totalExercises: routineExercises.length,
    }, { status: 201 });
  } catch (error) {
    console.error("Generate routine error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
