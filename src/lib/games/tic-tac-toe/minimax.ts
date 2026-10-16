export type Cell = "X" | "O" | null;

export const WINNING_COMBINATIONS = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6],
];

export function getWinner(board: Cell[]): Cell {
	for (const [a, b, c] of WINNING_COMBINATIONS) {
		if (
			board[a] &&
			board[a] === board[b] &&
			board[a] === board[c]
		) {
			return board[a];
		}
	}

	return null;
}

export function isDraw(board: Cell[]): boolean {
	return !getWinner(board) && board.every((cell) => cell !== null);
}

function getAvailableMoves(board: Cell[]): number[] {
	return board.reduce<number[]>((moves, cell, index) => {
		if (cell === null) {
			moves.push(index);
		}

		return moves;
	}, []);
}

function minimax(
	board: Cell[],
	depth: number,
	isMaximizing: boolean,
	alpha: number,
	beta: number
): number {
	const winner = getWinner(board);

	if (winner === "O") {
		return 10 - depth;
	}

	if (winner === "X") {
		return depth - 10;
	}

	if (isDraw(board)) {
		return 0;
	}

	const availableMoves = getAvailableMoves(board);

	if (isMaximizing) {
		let bestScore = -Infinity;

		for (const move of availableMoves) {
			board[move] = "O";

			const score = minimax(
				board,
				depth + 1,
				false,
				alpha,
				beta
			);

			board[move] = null;

			bestScore = Math.max(bestScore, score);
			alpha = Math.max(alpha, score);

			if (beta <= alpha) {
				break;
			}
		}

		return bestScore;
	}

	let bestScore = Infinity;

	for (const move of availableMoves) {
		board[move] = "X";

		const score = minimax(
			board,
			depth + 1,
			true,
			alpha,
			beta
		);

		board[move] = null;

		bestScore = Math.min(bestScore, score);
		beta = Math.min(beta, score);

		if (beta <= alpha) {
			break;
		}
	}

	return bestScore;
}

export function getBestMove(board: Cell[]): number | null {
	const availableMoves = getAvailableMoves(board);

	if (availableMoves.length === 0) {
		return null;
	}

	let bestScore = -Infinity;
	let bestMove = availableMoves[0];

	for (const move of availableMoves) {
		board[move] = "O";

		const score = minimax(
			board,
			0,
			false,
			-Infinity,
			Infinity
		);

		board[move] = null;

		if (score > bestScore) {
			bestScore = score;
			bestMove = move;
		}
	}

	return bestMove;
}