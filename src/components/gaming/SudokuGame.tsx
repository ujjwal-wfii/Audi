"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
	ArrowLeft,
	RotateCcw,
	Trash2,
} from "lucide-react";

import {
	generateSudoku,
	isBoardComplete,
	type Difficulty,
	type SudokuBoard,
} from "@/lib/games/sudoku/sudokuEngine";

import { submitScore } from "@/lib/games/leaderboard";

type CellPosition = {
	row: number;
	col: number;
};

const EMPTY_BOARD: SudokuBoard = Array.from(
	{ length: 9 },
	() => Array(9).fill(0),
);

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
		.toString()
		.padStart(2, "0")}`;
}

export function SudokuGame() {
	const [difficulty, setDifficulty] =
		useState<Difficulty>("medium");

	const [board, setBoard] =
		useState<SudokuBoard>(EMPTY_BOARD);

	const [solution, setSolution] =
		useState<SudokuBoard>(EMPTY_BOARD);

	const [initialBoard, setInitialBoard] =
		useState<SudokuBoard>(EMPTY_BOARD);

	const [selectedCell, setSelectedCell] =
		useState<CellPosition | null>(null);

	const [mistakes, setMistakes] = useState(0);

	const [completed, setCompleted] =
		useState(false);

	const [seconds, setSeconds] =
		useState(0);

	const [scoreSubmitted, setScoreSubmitted] =
		useState(false);

	const [wrongCells, setWrongCells] =
		useState<Set<string>>(new Set());

	/*
	 * Start a new Sudoku game.
	 */
	const startNewGame = useCallback(
		(level: Difficulty) => {
			const puzzle = generateSudoku(level);

			setBoard(
				puzzle.puzzle.map((row) => [...row]),
			);

			setInitialBoard(
				puzzle.puzzle.map((row) => [...row]),
			);

			setSolution(
				puzzle.solution.map((row) => [...row]),
			);

			setSelectedCell(null);
			setMistakes(0);
			setCompleted(false);
			setSeconds(0);
			setWrongCells(new Set());
			setScoreSubmitted(false);
		},
		[],
	);

	/*
	 * Start the first game.
	 */
	useEffect(() => {
		startNewGame("medium");
	}, [startNewGame]);

	/*
	 * Timer.
	 */
	useEffect(() => {
		if (completed) return;

		const timer = window.setInterval(() => {
			setSeconds((current) => current + 1);
		}, 1000);

		return () => {
			window.clearInterval(timer);
		};
	}, [completed]);

	/*
	 * Handle entering a number.
	 */
	const handleNumber = useCallback(
		async (number: number) => {
			if (completed || !selectedCell) return;

			const { row, col } = selectedCell;

			// Original puzzle clues cannot be changed.
			if (initialBoard[row]?.[col] !== 0) {
				return;
			}

			const nextBoard = board.map((currentRow) => [
				...currentRow,
			]);

			// Always put the entered number into the board.
			nextBoard[row][col] = number;

			setBoard(nextBoard);

			const cellKey = `${row}-${col}`;

			/*
			 * Correct number
			 */
			if (number === solution[row]?.[col]) {
				setWrongCells((current) => {
					const next = new Set(current);
					next.delete(cellKey);
					return next;
				});
			} else {
				/*
				 * Wrong number:
				 * keep it visible and mark it red.
				 */
				setWrongCells((current) => {
					const next = new Set(current);
					next.add(cellKey);
					return next;
				});

				setMistakes((current) => current + 1);
			}

			/*
			 * Check whether the entire Sudoku is solved.
			 */
			if (
				isBoardComplete(nextBoard, solution) &&
				!scoreSubmitted
			) {
				setCompleted(true);
				setScoreSubmitted(true);

				/*
				 * Sudoku leaderboard score.
				 *
				 * Faster completion = higher score
				 * Fewer mistakes = higher score
				 */
				const calculatedScore = Math.max(
					1000 -
						seconds * 5 -
						mistakes * 25,
					0,
				);

				try {
					await submitScore({
						game: "sudoku",
						score: calculatedScore,
						timeSeconds: seconds,
						mistakes,
						difficulty,
					});

					console.log(
						"Sudoku score submitted successfully.",
					);
				} catch (error) {
					console.error(
						"Failed to submit Sudoku score:",
						error,
					);
				}
			}
		},
		[
			board,
			completed,
			difficulty,
			initialBoard,
			mistakes,
			scoreSubmitted,
			selectedCell,
			seconds,
			solution,
		],
	);

	/*
	 * Clear selected cell.
	 */
	const clearCell = useCallback(() => {
		if (completed || !selectedCell) return;

		const { row, col } = selectedCell;

		// Original clues cannot be deleted.
		if (initialBoard[row]?.[col] !== 0) {
			return;
		}

		const nextBoard = board.map((currentRow) => [
			...currentRow,
		]);

		nextBoard[row][col] = 0;

		setBoard(nextBoard);

		const cellKey = `${row}-${col}`;

		setWrongCells((current) => {
			const next = new Set(current);
			next.delete(cellKey);
			return next;
		});
	}, [
		board,
		completed,
		initialBoard,
		selectedCell,
	]);

	/*
	 * Keyboard controls.
	 *
	 * 1-9       → enter number
	 * Backspace → clear
	 * Delete    → clear
	 * 0         → clear
	 * Arrow keys → move selection
	 */
	useEffect(() => {
		const handleKeyDown = (
			event: KeyboardEvent,
		) => {
			if (completed) return;

			/*
			 * Number keys 1-9.
			 */
			if (/^[1-9]$/.test(event.key)) {
				event.preventDefault();

				void handleNumber(
					Number(event.key),
				);

				return;
			}

			/*
			 * Clear cell.
			 */
			if (
				event.key === "Backspace" ||
				event.key === "Delete" ||
				event.key === "0"
			) {
				event.preventDefault();

				clearCell();

				return;
			}

			if (!selectedCell) return;

			let { row, col } = selectedCell;

			switch (event.key) {
				case "ArrowUp":
					event.preventDefault();
					row = Math.max(0, row - 1);
					break;

				case "ArrowDown":
					event.preventDefault();
					row = Math.min(8, row + 1);
					break;

				case "ArrowLeft":
					event.preventDefault();
					col = Math.max(0, col - 1);
					break;

				case "ArrowRight":
					event.preventDefault();
					col = Math.min(8, col + 1);
					break;

				default:
					return;
			}

			setSelectedCell({
				row,
				col,
			});
		};

		window.addEventListener(
			"keydown",
			handleKeyDown,
		);

		return () => {
			window.removeEventListener(
				"keydown",
				handleKeyDown,
			);
		};
	}, [
		clearCell,
		completed,
		handleNumber,
		selectedCell,
	]);

	/*
	 * Change difficulty.
	 */
	const handleDifficultyChange = (
		level: Difficulty,
	) => {
		setDifficulty(level);
		startNewGame(level);
	};

	/*
	 * New game.
	 */
	const handleNewGame = () => {
		startNewGame(difficulty);
	};

	return (
		<div className="flex h-screen w-full flex-col overflow-hidden bg-slate-950 text-white">

			{/* ================= HEADER ================= */}

			<header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2 sm:px-6">

				<div className="flex items-center gap-3">

					<Link
						href="/hangout/gaming"
						className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition hover:bg-white/10"
					>
						<ArrowLeft className="h-4 w-4" />
					</Link>

					<div>
						<h1 className="text-base font-semibold sm:text-lg">
							Sudoku
						</h1>

						<p className="hidden text-xs text-slate-500 sm:block">
							Fill every row, column, and 3×3 box.
						</p>
					</div>

				</div>

				<button
					type="button"
					onClick={handleNewGame}
					className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10 sm:text-sm"
				>
					<RotateCcw className="h-4 w-4" />

					<span>
						New Game
					</span>
				</button>

			</header>

			{/* ================= MAIN ================= */}

			<main className="min-h-0 flex-1 overflow-hidden px-3 py-2 sm:px-6">

				<div className="mx-auto flex h-full w-full max-w-6xl items-center justify-center">

					<div className="flex w-full flex-col items-center gap-3 lg:flex-row lg:items-center lg:justify-center lg:gap-10">

						{/* ================= SUDOKU BOARD ================= */}

						<div className="flex min-h-0 flex-col items-center">

							<div
								className="grid aspect-square w-[min(82vw,460px)] overflow-hidden rounded-xl border-2 border-white/20 bg-slate-900 shadow-2xl"
								style={{
									gridTemplateColumns:
										"repeat(9, minmax(0, 1fr))",

									gridTemplateRows:
										"repeat(9, minmax(0, 1fr))",
								}}
							>

								{board.map(
									(row, rowIndex) =>
										row.map(
											(
												value,
												colIndex,
											) => {

												const isGiven =
													initialBoard[
														rowIndex
													]?.[
														colIndex
													] !== 0;

												const cellKey =
													`${rowIndex}-${colIndex}`;

												const isWrong =
													wrongCells.has(
														cellKey,
													);

												const isSelected =
													selectedCell?.row ===
														rowIndex &&
													selectedCell?.col ===
														colIndex;

												const isSameRow =
													selectedCell?.row ===
													rowIndex;

												const isSameColumn =
													selectedCell?.col ===
													colIndex;

												const isSameBox =
													selectedCell &&
													Math.floor(
														selectedCell.row /
															3,
													) ===
														Math.floor(
															rowIndex /
																3,
														) &&
													Math.floor(
														selectedCell.col /
															3,
													) ===
														Math.floor(
															colIndex /
																3,
														);

												const borderRight =
													colIndex === 2 ||
													colIndex === 5
														? "border-r-2"
														: "border-r";

												const borderBottom =
													rowIndex === 2 ||
													rowIndex === 5
														? "border-b-2"
														: "border-b";

												return (
													<button
														key={`${rowIndex}-${colIndex}`}
														type="button"
														onClick={() =>
															setSelectedCell(
																{
																	row: rowIndex,
																	col: colIndex,
																},
															)
														}
														className={[
															"flex min-w-0 items-center justify-center border-white/10 text-sm transition sm:text-base",

															borderRight,
															borderBottom,

															isSelected
																? "bg-cyan-500/30"
																: isSameRow ||
																	  isSameColumn ||
																	  isSameBox
																	? "bg-white/[0.06]"
																	: "hover:bg-white/[0.05]",

															isGiven
																? "font-bold text-white"
																: isWrong
																	? "font-semibold text-red-400"
																	: "font-medium text-cyan-300",
														].join(
															" ",
														)}
													>
														{value !==
														0
															? value
															: ""}
													</button>
												);
											},
										),
								)}

							</div>

							<p className="mt-2 hidden text-center text-[11px] text-slate-500 sm:block">
								Select a cell → use number keys
								or the number pad
							</p>

						</div>

						{/* ================= CONTROLS ================= */}

						<div className="flex w-full max-w-[460px] flex-col gap-2 lg:w-[320px] lg:max-w-none">

							{/* Difficulty */}

							<div>

								<div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
									Difficulty
								</div>

								<div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">

									{(
										[
											"easy",
											"medium",
											"hard",
										] as Difficulty[]
									).map(
										(level) => (
											<button
												key={
													level
												}
												type="button"
												onClick={() =>
													handleDifficultyChange(
														level,
													)
												}
												className={`rounded-md px-2 py-1.5 text-xs capitalize transition ${
													difficulty ===
													level
														? "bg-cyan-500/20 text-cyan-300"
														: "text-slate-400 hover:bg-white/5 hover:text-white"
												}`}
											>
												{
													level
												}
											</button>
										),
									)}

								</div>

							</div>

							{/* Stats */}

							<div className="grid grid-cols-2 gap-2">

								<div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">

									<div className="text-[10px] uppercase tracking-wider text-slate-500">
										Time
									</div>

									<div className="mt-0.5 text-base font-semibold tabular-nums">
										{formatTime(
											seconds,
										)}
									</div>

								</div>

								<div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">

									<div className="text-[10px] uppercase tracking-wider text-slate-500">
										Mistakes
									</div>

									<div className="mt-0.5 text-base font-semibold">
										{
											mistakes
										}
									</div>

								</div>

							</div>

							{/* Number Pad */}

							<div>

								<div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
									Enter Number
								</div>

								<div className="grid grid-cols-5 gap-1">

									{[
										1,
										2,
										3,
										4,
										5,
										6,
										7,
										8,
										9,
									].map(
										(
											number,
										) => (
											<button
												key={
													number
												}
												type="button"
												onClick={() =>
													void handleNumber(
														number,
													)
												}
												className="rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-semibold transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300 active:scale-95"
											>
												{
													number
												}
											</button>
										),
									)}

									<button
										type="button"
										onClick={
											clearCell
										}
										className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-xs text-slate-400 transition hover:bg-red-400/10 hover:text-red-300 active:scale-95"
									>
										<Trash2 className="h-3.5 w-3.5" />

										Clear
									</button>

								</div>

							</div>

							{/* Keyboard help */}

							<div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-slate-500">

								<span className="text-slate-400">
									Keyboard:
								</span>{" "}

								1–9 to enter · Backspace to
								clear · Arrow keys to move

							</div>

							{/* Completion */}

							{completed && (
								<div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center">

									<div className="text-sm font-semibold text-emerald-300">
										Puzzle Complete!
									</div>

									<div className="mt-1 text-xs text-slate-400">
										Time:{" "}
										{formatTime(
											seconds,
										)}{" "}
										· Mistakes:{" "}
										{
											mistakes
										}
									</div>

									<div className="mt-1 text-[10px] text-emerald-400/70">
										Score submitted to
										leaderboard
									</div>

									<button
										type="button"
										onClick={
											handleNewGame
										}
										className="mt-2 rounded-lg bg-emerald-400/20 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-400/30"
									>
										Play Again
									</button>

								</div>
							)}

						</div>

					</div>

				</div>

			</main>
		</div>
	);
}