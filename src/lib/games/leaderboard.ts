
"use client";

import { createClient } from "@/lib/supabase/client";

export type GameType = "snake" | "sudoku" | "tic-tac-toe";

export interface SubmitScoreInput {
  game: GameType;
  score: number;
  timeSeconds?: number;
  mistakes?: number;
  difficulty?: string;
}

export interface LeaderboardScore {
  id: string;
  user_id: string;
  game: GameType;
  score: number;
  time_seconds: number | null;
  mistakes: number | null;
  difficulty: string | null;
  created_at: string;

  profiles:
    | { name: string }
    | { name: string }[]
    | null;
}

/** Expected result returned by the get_leaderboard RPC. */
type LeaderboardRpcRow = {
  score_id: string;
  user_id: string;
  game: string;
  score: number;
  time_seconds: number | null;
  mistakes: number | null;
  difficulty: string | null;
  created_at: string;
  player_name: string;
};

/**
 * Submit a score using the database function.
 */
export async function submitScore({
  game,
  score,
  timeSeconds,
  mistakes,
  difficulty,
}: SubmitScoreInput): Promise<LeaderboardScore | null> {
  const supabase = createClient();

  if (!Number.isInteger(score) || score < 0) {
    throw new Error("Score must be a non-negative integer.");
  }

  if (
    timeSeconds !== undefined &&
    (!Number.isInteger(timeSeconds) || timeSeconds < 0)
  ) {
    throw new Error("Time must be a non-negative integer.");
  }

  if (
    mistakes !== undefined &&
    (!Number.isInteger(mistakes) || mistakes < 0)
  ) {
    throw new Error("Mistakes must be a non-negative integer.");
  }

  if (game === "sudoku" && (!difficulty || !difficulty.trim())) {
    throw new Error("Sudoku difficulty is required.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be logged in to submit a score.");
  }

  const { data, error } = await supabase.rpc("submit_game_score", {
    p_game: game,
    p_score: score,
    p_time_seconds: timeSeconds ?? null,
    p_mistakes: mistakes ?? null,
    p_difficulty: game === "sudoku" ? difficulty!.trim() : null,
  });

  if (error) {
    console.error("Failed to submit game score:", error);
    throw new Error(error.message || "Failed to submit game score.");
  }

  return data as LeaderboardScore | null;
}

/**
 * Get the leaderboard using the secure get_leaderboard RPC.
 * The RPC returns player names without exposing profile columns.
 */
export async function getLeaderboard(
  game: GameType,
  limit = 10,
  difficulty?: string
): Promise<LeaderboardScore[]> {
  const supabase = createClient();

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Leaderboard limit must be a positive integer.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be logged in to view the leaderboard.");
  }

  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_game: game,
    p_limit: limit,
    p_difficulty: game === "sudoku" ? difficulty ?? null : null,
  });

  if (error) {
    console.error("Failed to load leaderboard:", error);
    throw new Error(error.message || "Failed to load leaderboard.");
  }

  // Explicitly type the RPC rows so TypeScript recognizes each property.
  const rows = (data ?? []) as unknown as LeaderboardRpcRow[];

  return rows.map(
    (row): LeaderboardScore => ({
      id: row.score_id,
      user_id: row.user_id,
      game: row.game as GameType,
      score: row.score,
      time_seconds: row.time_seconds,
      mistakes: row.mistakes,
      difficulty: row.difficulty,
      created_at: row.created_at,
      profiles: {
        name: row.player_name || "Unknown Player",
      },
    })
  );
}

/**
 * Get the authenticated user's scores.
 * Optionally filter by game and Sudoku difficulty.
 */
export async function getMyScores(
  game?: GameType,
  difficulty?: string
): Promise<LeaderboardScore[]> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be logged in to view your scores.");
  }

  let query = supabase
    .from("game_scores")
    .select(`
      id,
      user_id,
      game,
      score,
      time_seconds,
      mistakes,
      difficulty,
      created_at,
      profiles (
        name
      )
    `)
    .eq("user_id", user.id)
    .order("score", { ascending: false });

  if (game) {
    query = query.eq("game", game);
  }

  if (game === "sudoku" && difficulty) {
    query = query.eq("difficulty", difficulty);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load your scores:", error);
    throw new Error(error.message || "Failed to load your scores.");
  }

  return (data ?? []) as unknown as LeaderboardScore[];
}
