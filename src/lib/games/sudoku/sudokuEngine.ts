export type Difficulty = "easy" | "medium" | "hard";

export type SudokuBoard = number[][];

export interface SudokuPuzzle {
	puzzle: SudokuBoard;
	solution: SudokuBoard;
}

const SIZE = 9;

function shuffle<T>(array: T[]): T[] {
	const result = [...array];

	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));

		[result[i], result[j]] = [
			result[j],
			result[i],
		];
	}

	return result;
}

function isValid(
	board: SudokuBoard,
	row: number,
	col: number,
	num: number
): boolean {
	for (let i = 0; i < SIZE; i++) {
		if (board[row][i] === num) {
			return false;
		}

		if (board[i][col] === num) {
			return false;
		}
	}

	const boxRow = Math.floor(row / 3) * 3;
	const boxCol = Math.floor(col / 3) * 3;

	for (let r = boxRow; r < boxRow + 3; r++) {
		for (
			let c = boxCol;
			c < boxCol + 3;
			c++
		) {
			if (board[r][c] === num) {
				return false;
			}
		}
	}

	return true;
}

function solve(board: SudokuBoard): boolean {
	for (let row = 0; row < SIZE; row++) {
		for (let col = 0; col < SIZE; col++) {
			if (board[row][col] !== 0) {
				continue;
			}

			const numbers = shuffle([
				1, 2, 3, 4, 5,
				6, 7, 8, 9,
			]);

			for (const num of numbers) {
				if (
					isValid(
						board,
						row,
						col,
						num
					)
				) {
					board[row][col] = num;

					if (solve(board)) {
						return true;
					}

					board[row][col] = 0;
				}
			}

			return false;
		}
	}

	return true;
}

function createEmptyBoard(): SudokuBoard {
	return Array.from(
		{ length: SIZE },
		() => Array(SIZE).fill(0)
	);
}

function getCellsToRemove(
	difficulty: Difficulty
): number {
	switch (difficulty) {
		case "easy":
			return 35;

		case "medium":
			return 45;

		case "hard":
			return 52;

		default:
			return 45;
	}
}

export function generateSudoku(
	difficulty: Difficulty
): SudokuPuzzle {
	const solution = createEmptyBoard();

	solve(solution);

	const puzzle = solution.map((row) => [
		...row,
	]);

	const cellsToRemove =
		getCellsToRemove(difficulty);

	const positions = shuffle(
		Array.from(
			{ length: SIZE * SIZE },
			(_, index) => index
		)
	);

	for (
		let i = 0;
		i < cellsToRemove;
		i++
	) {
		const position = positions[i];

		const row = Math.floor(
			position / SIZE
		);

		const col = position % SIZE;

		puzzle[row][col] = 0;
	}

	return {
		puzzle,
		solution,
	};
}

export function isBoardComplete(
	board: SudokuBoard,
	solution: SudokuBoard
): boolean {
	for (let row = 0; row < SIZE; row++) {
		for (let col = 0; col < SIZE; col++) {
			if (
				board[row][col] !==
				solution[row][col]
			) {
				return false;
			}
		}
	}

	return true;
}