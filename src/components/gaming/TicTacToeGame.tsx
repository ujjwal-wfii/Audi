"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
	ArrowLeft,
	RotateCcw,
	Trophy,
} from "lucide-react";

import {
	type Cell,
	getBestMove,
	getWinner,
	isDraw,
} from "@/lib/games/tic-tac-toe/minimax";

import { submitScore } from "@/lib/games/leaderboard";

type Result = "win" | "loss" | "draw" | null;

interface Score {
	wins: number;
	draws: number;
	losses: number;
}

const EMPTY_BOARD: Cell[] = Array(9).fill(null);

export function TicTacToeGame() {
	const [board, setBoard] = useState<Cell[]>(EMPTY_BOARD);
	const [playerTurn, setPlayerTurn] = useState(true);
	const [result, setResult] = useState<Result>(null);

	const [score, setScore] = useState<Score>({
		wins: 0,
		draws: 0,
		losses: 0,
	});

	const gameOver = result !== null;

	async function finishGame(
		finalBoard: Cell[],
		player: "X" | "O"
	) {
		const winner = getWinner(finalBoard);

		let gameResult: Result;
		let gameScore: number;

		if (winner === "X") {
			gameResult = "win";
			gameScore = 100;

			setScore((previous) => ({
				...previous,
				wins: previous.wins + 1,
			}));
		} else if (winner === "O") {
			gameResult = "loss";
			gameScore = 0;

			setScore((previous) => ({
				...previous,
				losses: previous.losses + 1,
			}));
		} else if (isDraw(finalBoard)) {
			gameResult = "draw";
			gameScore = 50;

			setScore((previous) => ({
				...previous,
				draws: previous.draws + 1,
			}));
		} else {
			setPlayerTurn(player === "O");
			return;
		}

		setResult(gameResult);

		try {
			await submitScore({
				game: "tic-tac-toe",
				score: gameScore,
			});
		} catch (error) {
			console.error(
				"Failed to submit Tic-Tac-Toe score:",
				error
			);
		}
	}

	function handleCellClick(index: number) {
		if (!playerTurn || gameOver || board[index] !== null) {
			return;
		}

		const nextBoard = [...board];
		nextBoard[index] = "X";

		setBoard(nextBoard);

		const winner = getWinner(nextBoard);

		if (winner || isDraw(nextBoard)) {
			void finishGame(nextBoard, "X");
			return;
		}

		setPlayerTurn(false);
	}

	useEffect(() => {
		if (playerTurn || gameOver) {
			return;
		}

		const timer = window.setTimeout(() => {
			const nextBoard = [...board];
			const move = getBestMove(nextBoard);

			if (move === null) {
				return;
			}

			nextBoard[move] = "O";

			setBoard(nextBoard);

			const winner = getWinner(nextBoard);

			if (winner || isDraw(nextBoard)) {
				void finishGame(nextBoard, "O");
				return;
			}

			setPlayerTurn(true);
		}, 400);

		return () => window.clearTimeout(timer);
	}, [board, playerTurn, gameOver]);

	function newGame() {
		setBoard([...EMPTY_BOARD]);
		setPlayerTurn(true);
		setResult(null);
	}

	function getStatusText() {
		if (result === "win") {
			return "You won!";
		}

		if (result === "loss") {
			return "Computer won!";
		}

		if (result === "draw") {
			return "It's a draw!";
		}

		if (playerTurn) {
			return "Your turn";
		}

		return "Computer is thinking...";
	}

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-white">
			{/* Header */}
			<header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
				<Link
					href="/hangout/gaming"
					className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Gaming
				</Link>

				<h1 className="text-lg font-semibold sm:text-xl">
					Tic-Tac-Toe
				</h1>

				<button
					onClick={newGame}
					className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10 sm:text-sm"
				>
					<RotateCcw className="h-4 w-4" />
					New Game
				</button>
			</header>

			{/* Main */}
			<main className="flex min-h-0 flex-1 items-center justify-center px-4 py-4">
				<div className="flex w-full max-w-md flex-col items-center">
					{/* Score */}
					<div className="mb-4 flex items-center gap-6 text-center sm:mb-6">
						<div>
							<p className="text-xs text-slate-500">
								Wins
							</p>
							<p className="text-lg font-semibold text-cyan-400">
								{score.wins}
							</p>
						</div>

						<div>
							<p className="text-xs text-slate-500">
								Draws
							</p>
							<p className="text-lg font-semibold">
								{score.draws}
							</p>
						</div>

						<div>
							<p className="text-xs text-slate-500">
								Losses
							</p>
							<p className="text-lg font-semibold text-red-400">
								{score.losses}
							</p>
						</div>
					</div>

					{/* Status */}
					<div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
						<Trophy className="h-4 w-4 text-cyan-400" />
						{getStatusText()}
					</div>

					{/* Board */}
					<div className="grid w-[min(82vw,380px)] grid-cols-3 gap-2 sm:gap-3">
						{board.map((cell, index) => (
							<button
								key={index}
								onClick={() => handleCellClick(index)}
								disabled={
									cell !== null ||
									!playerTurn ||
									gameOver
								}
								className="aspect-square rounded-xl border border-white/10 bg-white/[0.05] text-[clamp(2rem,10vw,4rem)] font-bold transition hover:bg-white/[0.09] disabled:cursor-default"
							>
								<span
									className={
										cell === "X"
											? "text-cyan-400"
											: "text-red-400"
									}
								>
									{cell}
								</span>
							</button>
						))}
					</div>

					{/* Result */}
					{gameOver && (
						<div className="mt-5 text-center">
							<p className="text-lg font-semibold">
								{getStatusText()}
							</p>

							<button
								onClick={newGame}
								className="mt-3 rounded-lg bg-cyan-500 px-5 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
							>
								Play Again
							</button>
						</div>
					)}

					<p className="mt-5 text-xs text-slate-600">
						You are X · Computer is O
					</p>
				</div>
			</main>
		</div>
	);
}