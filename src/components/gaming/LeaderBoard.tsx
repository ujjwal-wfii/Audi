"use client";

import { useEffect, useState } from "react";
import { Trophy, RefreshCw } from "lucide-react";

import {
	getLeaderboard,
	type GameType,
	type LeaderboardScore,
} from "@/lib/games/leaderboard";

const games: {
	value: GameType;
	label: string;
}[] = [
	{
		value: "snake",
		label: "Snake",
	},
	{
		value: "sudoku",
		label: "Sudoku",
	},
	{
		value: "tic-tac-toe",
		label: "Tic-Tac-Toe",
	},
];

export function Leaderboard() {
	const [selectedGame, setSelectedGame] =
		useState<GameType>("snake");

	const [scores, setScores] = useState<LeaderboardScore[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	async function loadLeaderboard() {
		setLoading(true);
		setError(null);

		try {
			const data = await getLeaderboard(selectedGame, 10);

			setScores(data);
		} catch (error) {
			console.error(
				"Failed to load leaderboard:",
				error,
			);

			setError(
				error instanceof Error
					? error.message
					: "Failed to load leaderboard.",
			);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void loadLeaderboard();
	}, [selectedGame]);

	function getPlayerName(score: LeaderboardScore) {
		const profile = Array.isArray(score.profiles)
			? score.profiles[0]
			: score.profiles;

		return profile?.name || "Unknown Player";
	}

	function formatSudokuTime(
		seconds: number | null,
	) {
		if (seconds === null) {
			return "-";
		}

		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;

		return `${minutes}:${remainingSeconds
			.toString()
			.padStart(2, "0")}`;
	}

	function getScoreDisplay(score: LeaderboardScore) {
		if (selectedGame === "sudoku") {
			return formatSudokuTime(
				score.time_seconds,
			);
		}

		return score.score.toString();
	}

	function getSecondaryDisplay(
		score: LeaderboardScore,
	) {
		if (selectedGame === "sudoku") {
			return `${score.mistakes ?? 0} mistakes`;
		}

		return null;
	}

	return (
		<div className="flex h-full min-h-0 flex-col bg-slate-950 text-white">
			{/* Header */}
			<header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
				<div className="flex min-w-0 items-center gap-2">
					<Trophy className="h-5 w-5 shrink-0 text-cyan-400" />

					<h1 className="truncate text-lg font-semibold">
						Leaderboard
					</h1>
				</div>

				<button
					onClick={() => void loadLeaderboard()}
					disabled={loading}
					className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<RefreshCw
						className={`h-4 w-4 ${
							loading
								? "animate-spin"
								: ""
						}`}
					/>

					<span>Refresh</span>
				</button>
			</header>

			{/* Scrollable leaderboard content */}
			<main className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
				<div className="w-full">
					{/* Game Tabs */}
					<div className="mb-4 flex flex-wrap gap-2">
						{games.map((game) => (
							<button
								key={game.value}
								onClick={() =>
									setSelectedGame(
										game.value,
									)
								}
								className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
									selectedGame ===
									game.value
										? "bg-cyan-500 text-slate-950"
										: "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
								}`}
							>
								{game.label}
							</button>
						))}
					</div>

					{/* Current Game */}
					<div className="mb-4">
						<h2 className="text-base font-semibold">
							{
								games.find(
									(game) =>
										game.value ===
										selectedGame,
								)?.label
							}
						</h2>

						<p className="mt-1 text-xs text-slate-500">
							{selectedGame ===
							"sudoku"
								? "Fastest time, then fewest mistakes."
								: "Highest score wins."}
						</p>
					</div>

					{/* Error */}
					{error && (
						<div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
							{error}
						</div>
					)}

					{/* Loading */}
					{loading && !error && (
						<div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-xs text-slate-400">
							Loading leaderboard...
						</div>
					)}

					{/* Empty State */}
					{!loading &&
						!error &&
						scores.length === 0 && (
							<div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
								<Trophy className="mx-auto h-8 w-8 text-slate-600" />

								<p className="mt-3 text-xs text-slate-400">
									No scores yet.
								</p>

								<p className="mt-1 text-[11px] text-slate-600">
									Play this game to
									appear here.
								</p>
							</div>
						)}

					{/* Leaderboard Table */}
					{!loading &&
						!error &&
						scores.length > 0 && (
							<div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
								{/* Table Header */}
								<div className="grid grid-cols-[42px_1fr_75px] border-b border-white/10 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
									<div>Rank</div>

									<div>Player</div>

									<div className="text-right">
										{selectedGame ===
										"sudoku"
											? "Time"
											: "Score"}
									</div>
								</div>

								{/* Rows */}
								<div>
									{scores.map(
										(
											score,
											index,
										) => (
											<div
												key={
													score.id
												}
												className="grid grid-cols-[42px_1fr_75px] items-center border-b border-white/5 px-3 py-3 last:border-b-0"
											>
												{/* Rank */}
												<div className="text-xs font-semibold text-slate-400">
													{index ===
													0
														? "🥇"
														: index ===
														  1
														? "🥈"
														: index ===
														  2
														? "🥉"
														: `#${index + 1}`}
												</div>

												{/* Player */}
												<div className="min-w-0 pr-2">
													<p className="truncate text-xs font-medium text-white">
														{getPlayerName(
															score,
														)}
													</p>

													{getSecondaryDisplay(
														score,
													) && (
														<p className="mt-0.5 truncate text-[10px] text-slate-500">
															{
																getSecondaryDisplay(
																	score,
																)
															}
														</p>
													)}
												</div>

												{/* Score */}
												<div className="text-right">
													<p className="text-xs font-semibold text-cyan-400">
														{getScoreDisplay(
															score,
														)}
													</p>

													{selectedGame ===
														"sudoku" && (
														<p className="mt-0.5 text-[10px] text-slate-600">
															min
														</p>
													)}
												</div>
											</div>
										),
									)}
								</div>
							</div>
						)}
				</div>
			</main>
		</div>
	);
}