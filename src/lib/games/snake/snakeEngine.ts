export type Direction =
	| "UP"
	| "DOWN"
	| "LEFT"
	| "RIGHT";

export type FoodType =
	| "apple"
	| "grapes"
	| "carrot"
	| "star";

export interface Position {
	x: number;
	y: number;
}

export interface Food {
	x: number;
	y: number;
	type: FoodType;
	points: number;
}

export interface SnakeState {
	snake: Position[];
	food: Food;
	direction: Direction;
	score: number;
	lives: number;
	gameOver: boolean;
}

export const GRID_SIZE = 20;

export const INITIAL_LIVES = 3;

const FOOD_POINTS: Record<FoodType, number> = {
	apple: 10,
	grapes: 15,
	carrot: 20,
	star: 25,
};

const FOOD_TYPES: FoodType[] = [
	"apple",
	"grapes",
	"carrot",
	"star",
];

const INITIAL_SNAKE: Position[] = [
	{ x: 10, y: 10 },
	{ x: 9, y: 10 },
	{ x: 8, y: 10 },
];

function createFoodPosition(
	snake: Position[]
): Position {
	const available: Position[] = [];

	for (let y = 0; y < GRID_SIZE; y++) {
		for (let x = 0; x < GRID_SIZE; x++) {
			const occupied = snake.some(
				(segment) =>
					segment.x === x &&
					segment.y === y
			);

			if (!occupied) {
				available.push({ x, y });
			}
		}
	}

	if (available.length === 0) {
		return { x: 0, y: 0 };
	}

	return available[
		Math.floor(Math.random() * available.length)
	];
}

export function createFood(
	snake: Position[]
): Food {
	const position = createFoodPosition(snake);

	const type =
		FOOD_TYPES[
			Math.floor(
				Math.random() *
					FOOD_TYPES.length
			)
		];

	return {
		x: position.x,
		y: position.y,
		type,
		points: FOOD_POINTS[type],
	};
}

export function createInitialState(): SnakeState {
	const snake = [...INITIAL_SNAKE];

	return {
		snake,
		food: createFood(snake),
		direction: "RIGHT",
		score: 0,
		lives: INITIAL_LIVES,
		gameOver: false,
	};
}

export function getNextHead(
	head: Position,
	direction: Direction
): Position {
	switch (direction) {
		case "UP":
			return {
				x: head.x,
				y: head.y - 1,
			};

		case "DOWN":
			return {
				x: head.x,
				y: head.y + 1,
			};

		case "LEFT":
			return {
				x: head.x - 1,
				y: head.y,
			};

		case "RIGHT":
			return {
				x: head.x + 1,
				y: head.y,
			};
	}
}

export function isWallCollision(
	position: Position
): boolean {
	return (
		position.x < 0 ||
		position.x >= GRID_SIZE ||
		position.y < 0 ||
		position.y >= GRID_SIZE
	);
}

export function isSnakeCollision(
	position: Position,
	snake: Position[]
): boolean {
	return snake.some(
		(segment) =>
			segment.x === position.x &&
			segment.y === position.y
	);
}

function resetSnakeAfterLifeLoss(
	lives: number,
	score: number
): SnakeState {
	const snake = [...INITIAL_SNAKE];

	return {
		snake,
		food: createFood(snake),
		direction: "RIGHT",
		score,
		lives,
		gameOver: lives <= 0,
	};
}

export function moveSnake(
	state: SnakeState,
	direction: Direction
): SnakeState {
	if (state.gameOver) {
		return state;
	}

	const head = state.snake[0];

	const newHead = getNextHead(
		head,
		direction
	);

	const wallCollision =
		isWallCollision(newHead);

	const ateFood =
		newHead.x === state.food.x &&
		newHead.y === state.food.y;

	const bodyToCheck = ateFood
		? state.snake
		: state.snake.slice(0, -1);

	const snakeCollision =
		isSnakeCollision(
			newHead,
			bodyToCheck
		);

	/*
	 * A collision costs one life.
	 *
	 * The score is preserved and the snake
	 * is reset to its starting position.
	 */
	if (wallCollision || snakeCollision) {
		const remainingLives =
			state.lives - 1;

		return resetSnakeAfterLifeLoss(
			remainingLives,
			state.score
		);
	}

	const newSnake = [
		newHead,
		...state.snake,
	];

	if (!ateFood) {
		newSnake.pop();
	}

	return {
		...state,
		snake: newSnake,
		food: ateFood
			? createFood(newSnake)
			: state.food,
		direction,
		score: ateFood
			? state.score +
				state.food.points
			: state.score,
	};
}

export function isOppositeDirection(
	current: Direction,
	next: Direction
): boolean {
	return (
		(current === "UP" &&
			next === "DOWN") ||
		(current === "DOWN" &&
			next === "UP") ||
		(current === "LEFT" &&
			next === "RIGHT") ||
		(current === "RIGHT" &&
			next === "LEFT")
	);
}