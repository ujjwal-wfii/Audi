"use client";

import {
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";

import {
	GRID_SIZE,
	createInitialState,
	moveSnake,
	isOppositeDirection,
	type Direction,
} from "@/lib/games/snake/snakeEngine";

import { submitScore } from "@/lib/games/leaderboard";

import { PixelFood } from "@/components/gaming/snake/PixelFood";
import { PixelSnakeHead } from "@/components/gaming/snake/PixelSnakeHead";

const KEY_TO_DIRECTION: Record<string, Direction> = {
	ArrowUp: "UP",
	ArrowDown: "DOWN",
	ArrowLeft: "LEFT",
	ArrowRight: "RIGHT",

	w: "UP",
	W: "UP",

	s: "DOWN",
	S: "DOWN",

	a: "LEFT",
	A: "LEFT",

	d: "RIGHT",
	D: "RIGHT",
};

const BEST_SCORE_STORAGE_KEY = "snake-best-score";
const BEST_SCORE_CHANGE_EVENT = "snake-best-score-change";

function getBestScoreSnapshot() {
	const storedBest = Number(
		window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || "0"
	);

	return Number.isFinite(storedBest) ? storedBest : 0;
}

function subscribeToBestScore(onChange: () => void) {
	const handleStorageChange = (event: StorageEvent) => {
		if (event.key === BEST_SCORE_STORAGE_KEY || event.key === null) {
			onChange();
		}
	};

	window.addEventListener("storage", handleStorageChange);
	window.addEventListener(BEST_SCORE_CHANGE_EVENT, onChange);

	return () => {
		window.removeEventListener("storage", handleStorageChange);
		window.removeEventListener(BEST_SCORE_CHANGE_EVENT, onChange);
	};
}

export function SnakeGame() {
	const router = useRouter();

	const [game, setGame] = useState(createInitialState);
	const [started, setStarted] = useState(false);
	const [paused, setPaused] = useState(false);

	const bestScore = useSyncExternalStore(
		subscribeToBestScore,
		getBestScoreSnapshot,
		() => 0
	);

	const directionRef = useRef<Direction>("RIGHT");
	const scoreSubmittedRef = useRef(false);

	/*
	|--------------------------------------------------------------------------
	| SAVE BEST SCORE
	|--------------------------------------------------------------------------
	*/

	useEffect(() => {
		if (game.score > bestScore) {
			localStorage.setItem(
				BEST_SCORE_STORAGE_KEY,
				String(game.score)
			);
			window.dispatchEvent(
				new Event(BEST_SCORE_CHANGE_EVENT)
			);
		}
	}, [game.score, bestScore]);

	/*
	|--------------------------------------------------------------------------
	| GAME LOOP
	|--------------------------------------------------------------------------
	|
	| IMPORTANT:
	| The game only runs when `started === true`.
	|
	*/

	useEffect(() => {
		if (!started || paused || game.gameOver) {
			return;
		}

		const interval = window.setInterval(() => {
			setGame((current) => {
				if (current.gameOver) {
					return current;
				}

				return moveSnake(
					current,
					directionRef.current
				);
			});
		}, 130);

		return () => {
			window.clearInterval(interval);
		};
	}, [started, paused, game.gameOver]);

	/*
	|--------------------------------------------------------------------------
	| KEYBOARD CONTROLS
	|--------------------------------------------------------------------------
	*/

	useEffect(() => {
		const handleKeyDown = (
			event: KeyboardEvent
		) => {
			const key = event.key;

			/*
			 * Do nothing before the game starts.
			 */
			if (!started) {
				return;
			}

			/*
			 * PAUSE / RESUME
			 */

			if (
				key === " " ||
				key === "Escape" ||
				key === "p" ||
				key === "P"
			) {
				event.preventDefault();

				if (!game.gameOver) {
					setPaused(
						(current) => !current
					);
				}

				return;
			}

			const nextDirection =
				KEY_TO_DIRECTION[key];

			if (!nextDirection) {
				return;
			}

			event.preventDefault();

			if (
				!isOppositeDirection(
					directionRef.current,
					nextDirection
				)
			) {
				directionRef.current =
					nextDirection;
			}
		};

		window.addEventListener(
			"keydown",
			handleKeyDown
		);

		return () => {
			window.removeEventListener(
				"keydown",
				handleKeyDown
			);
		};
	}, [started, game.gameOver]);

	/*
	|--------------------------------------------------------------------------
	| START GAME
	|--------------------------------------------------------------------------
	*/

	const startGame = () => {
		directionRef.current = "RIGHT";

		scoreSubmittedRef.current = false;

		setGame(createInitialState());

		setPaused(false);
		setStarted(true);
	};

	/*
	|--------------------------------------------------------------------------
	| RESTART GAME
	|--------------------------------------------------------------------------
	*/

	const restartGame = () => {
		directionRef.current = "RIGHT";

		scoreSubmittedRef.current = false;

		setGame(createInitialState());

		setPaused(false);
		setStarted(true);
	};

	/*
	|--------------------------------------------------------------------------
	| PAUSE / RESUME
	|--------------------------------------------------------------------------
	*/

	const togglePause = () => {
		if (!started || game.gameOver) {
			return;
		}

		setPaused((current) => !current);
	};

	/*
	|--------------------------------------------------------------------------
	| CHANGE DIRECTION
	|--------------------------------------------------------------------------
	*/

	const changeDirection = (
		direction: Direction
	) => {
		if (!started || paused || game.gameOver) {
			return;
		}

		if (
			!isOppositeDirection(
				directionRef.current,
				direction
			)
		) {
			directionRef.current = direction;
		}
	};

	/*
	|--------------------------------------------------------------------------
	| SUBMIT SCORE
	|--------------------------------------------------------------------------
	*/

	useEffect(() => {
		if (!game.gameOver) {
			scoreSubmittedRef.current = false;
			return;
		}

		if (scoreSubmittedRef.current) {
			return;
		}

		scoreSubmittedRef.current = true;

		if (game.score <= 0) {
			return;
		}

		submitScore({
			game: "snake",
			score: game.score,
		}).catch((error) => {
			console.error(
				"Failed to submit Snake score:",
				error
			);
		});
	}, [game.gameOver, game.score]);

	return (
		<div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#5799b5] text-white">
			{/* ========================================================= */}
			{/* HEADER */}
			{/* ========================================================= */}

			<header className="relative flex h-[58px] shrink-0 items-center justify-between px-3 sm:h-[72px] sm:px-6">
				{/* SCORE */}

				<div className="z-10 min-w-[80px] sm:min-w-[120px]">
					<p className="text-[9px] font-black uppercase tracking-wider text-white/80 sm:text-xs">
						Score
					</p>

					<p className="text-xl font-black leading-none text-white sm:text-3xl">
						{game.score}
					</p>

					<p className="hidden text-[9px] font-bold text-white/70 sm:block">
						BEST {bestScore}
					</p>
				</div>

				{/* TITLE */}

				<h1
					className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[20px] font-black italic tracking-wide text-[#ff4f9a] sm:text-4xl"
					style={{
						WebkitTextStroke:
							"1.5px #17104f",
						textShadow:
							"3px 3px 0 #17104f",
					}}
				>
					SNAKE GAME
				</h1>

				{/* LIVES */}

				<div className="z-10 min-w-[80px] text-right sm:min-w-[120px]">
					<p className="text-[9px] font-black uppercase tracking-wider text-white/80 sm:text-xs">
						Lives
					</p>

					<div className="flex justify-end gap-0.5 text-lg sm:gap-1 sm:text-2xl">
						{[0, 1, 2].map(
							(life) => (
								<span
									key={life}
									className={
										life <
										game.lives
											? "opacity-100"
											: "grayscale opacity-25"
									}
								>
									❤️
								</span>
							)
						)}
					</div>
				</div>
			</header>

			{/* ========================================================= */}
			{/* MAIN */}
			{/* ========================================================= */}

			<main className="flex min-h-0 flex-1 flex-col items-center justify-center px-2">
				{/* FOOD INFO */}

				<div className="mb-1 flex shrink-0 items-center gap-2 rounded-full border-2 border-[#17104f] bg-white/90 px-3 py-1 text-[9px] font-black text-[#17104f] shadow-[2px_2px_0_#17104f] sm:mb-2 sm:px-4 sm:py-1.5 sm:text-xs">
					<div className="h-5 w-5 sm:h-6 sm:w-6">
						<PixelFood
							type={game.food.type}
						/>
					</div>

					<span>
						+{game.food.points}{" "}
						POINTS
					</span>
				</div>

				{/* ===================================================== */}
				{/* GAME BOARD */}
				{/* ===================================================== */}

				<div
					className="
						relative
						aspect-square
						w-[min(92vw,calc(100dvh-200px))]
						max-w-[680px]
						overflow-hidden
						rounded-xl
						border-4
						border-[#17104f]
						bg-[#70b7c7]
						shadow-[5px_5px_0_#17104f]
						sm:rounded-2xl
						sm:border-[6px]
						sm:shadow-[8px_8px_0_#17104f]
					"
					style={{
						backgroundImage:
							"linear-gradient(rgba(23,16,79,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(23,16,79,0.12) 1px, transparent 1px)",

						backgroundSize: `${100 / GRID_SIZE}% ${100 / GRID_SIZE}%`,
					}}
				>
					{/* ================================================= */}
					{/* SNAKE */}
					{/* ================================================= */}

					{game.snake.map(
						(segment, index) => {
							const isHead =
								index === 0;

							return (
								<div
									key={`${segment.x}-${segment.y}-${index}`}
									className="absolute"
									style={{
										left: `${(segment.x / GRID_SIZE) * 100}%`,
										top: `${(segment.y / GRID_SIZE) * 100}%`,
										width: `${100 / GRID_SIZE}%`,
										height: `${100 / GRID_SIZE}%`,
									}}
								>
									{isHead ? (
										<PixelSnakeHead
											direction={
												game.direction
											}
										/>
									) : (
										<div className="h-full w-full p-[8%]">
											<div className="h-full w-full rounded-[25%] bg-[#52d411] shadow-[inset_-3px_-3px_0_#38a900]" />
										</div>
									)}
								</div>
							);
						}
					)}

					{/* ================================================= */}
					{/* FOOD */}
					{/* ================================================= */}

					<div
						className="absolute flex items-center justify-center"
						style={{
							left: `${(game.food.x / GRID_SIZE) * 100}%`,
							top: `${(game.food.y / GRID_SIZE) * 100}%`,
							width: `${100 / GRID_SIZE}%`,
							height: `${100 / GRID_SIZE}%`,
						}}
					>
						<PixelFood
							type={game.food.type}
						/>
					</div>

					{/* ================================================= */}
					{/* START GAME OVERLAY */}
					{/* ================================================= */}

					{!started && (
						<div className="absolute inset-0 z-40 flex items-center justify-center bg-[#17104f]/80 px-4">
							<div className="flex w-full max-w-[340px] flex-col items-center rounded-2xl border-4 border-[#17104f] bg-[#ffdf58] px-6 py-7 text-center shadow-[7px_7px_0_#17104f] sm:px-10 sm:py-9">
								<h2
									className="text-3xl font-black italic text-[#ff4f9a] sm:text-5xl"
									style={{
										WebkitTextStroke:
											"1px #17104f",
										textShadow:
											"3px 3px 0 #17104f",
									}}
								>
									SNAKE
								</h2>

								<p className="mt-2 text-xs font-bold text-[#17104f]/70 sm:text-sm">
									Eat the fruits and
									grow your snake!
								</p>

								<button
									onClick={
										startGame
									}
									className="mt-6 rounded-xl border-4 border-[#17104f] bg-[#52d411] px-8 py-3 text-sm font-black text-white shadow-[5px_5px_0_#17104f] transition hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#17104f] sm:px-10 sm:py-3.5 sm:text-base"
								>
									START GAME
								</button>
							</div>
						</div>
					)}

					{/* ================================================= */}
					{/* PAUSED */}
					{/* ================================================= */}

					{started &&
						paused &&
						!game.gameOver && (
							<div className="absolute inset-0 z-30 flex items-center justify-center bg-[#17104f]/75 px-4">
								<div className="flex w-full max-w-[300px] flex-col items-center rounded-2xl border-4 border-[#17104f] bg-[#ffdf58] px-6 py-6 text-center shadow-[6px_6px_0_#17104f]">
									<h2 className="text-2xl font-black italic text-[#17104f] sm:text-4xl">
										PAUSED
									</h2>

									<button
										onClick={
											togglePause
										}
										className="mt-5 rounded-xl border-4 border-[#17104f] bg-[#52d411] px-7 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#17104f]"
									>
										RESUME
									</button>
								</div>
							</div>
						)}

					{/* ================================================= */}
					{/* GAME OVER */}
					{/* ================================================= */}

					{game.gameOver && (
						<div className="absolute inset-0 z-40 flex items-center justify-center bg-[#17104f]/80 px-4">
							<div className="flex w-full max-w-[320px] flex-col items-center rounded-2xl border-4 border-[#17104f] bg-[#ffdf58] px-5 py-6 text-center shadow-[7px_7px_0_#17104f]">
								<h2 className="text-2xl font-black italic text-[#17104f] sm:text-4xl">
									GAME OVER
								</h2>

								<p className="mt-2 text-sm font-black text-[#17104f]">
									SCORE:{" "}
									{game.score}
								</p>

								<p className="mt-1 text-xs font-bold text-[#17104f]/70">
									BEST:{" "}
									{Math.max(
										bestScore,
										game.score
									)}
								</p>

								<button
									onClick={
										restartGame
									}
									className="mt-5 rounded-xl border-4 border-[#17104f] bg-[#52d411] px-6 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#17104f]"
								>
									RESTART
								</button>
							</div>
						</div>
					)}
				</div>

				{/* ===================================================== */}
				{/* DESKTOP CONTROLS */}
				{/* ===================================================== */}

				<div className="mt-2 hidden shrink-0 items-center gap-2 sm:flex">
					<button
						onClick={
							togglePause
						}
						disabled={
							!started ||
							game.gameOver
						}
						className="rounded-lg border-2 border-[#17104f] bg-[#ffdf58] px-5 py-2 text-xs font-black text-[#17104f] shadow-[3px_3px_0_#17104f] disabled:cursor-not-allowed disabled:opacity-40"
					>
						{paused
							? "RESUME"
							: "PAUSE"}
					</button>

					<button
						onClick={
							restartGame
						}
						className="rounded-lg border-2 border-[#17104f] bg-[#ff4f9a] px-5 py-2 text-xs font-black text-white shadow-[3px_3px_0_#17104f]"
					>
						RESTART
					</button>

					<span className="ml-2 text-[10px] font-bold text-white/80">
						ARROWS / WASD
						&nbsp; • &nbsp;
						SPACE = PAUSE
					</span>
				</div>
			</main>

			{/* ========================================================= */}
			{/* MOBILE CONTROLS */}
			{/* ========================================================= */}

			<div className="shrink-0 pb-1 sm:hidden">
				<div className="flex justify-center">
					<div className="grid grid-cols-3 gap-1">
						<div />

						<button
							onClick={() =>
								changeDirection(
									"UP"
								)
							}
							disabled={
								!started
							}
							className="flex h-9 w-11 items-center justify-center rounded-lg border-2 border-[#17104f] bg-[#ffdf58] text-base font-black text-[#17104f] shadow-[3px_3px_0_#17104f] disabled:opacity-40"
						>
							▲
						</button>

						<div />

						<button
							onClick={() =>
								changeDirection(
									"LEFT"
								)
							}
							disabled={
								!started
							}
							className="flex h-9 w-11 items-center justify-center rounded-lg border-2 border-[#17104f] bg-[#ffdf58] text-base font-black text-[#17104f] shadow-[3px_3px_0_#17104f] disabled:opacity-40"
						>
							◀
						</button>

						<button
							onClick={() =>
								changeDirection(
									"DOWN"
								)
							}
							disabled={
								!started
							}
							className="flex h-9 w-11 items-center justify-center rounded-lg border-2 border-[#17104f] bg-[#ffdf58] text-base font-black text-[#17104f] shadow-[3px_3px_0_#17104f] disabled:opacity-40"
						>
							▼
						</button>

						<button
							onClick={() =>
								changeDirection(
									"RIGHT"
								)
							}
							disabled={
								!started
							}
							className="flex h-9 w-11 items-center justify-center rounded-lg border-2 border-[#17104f] bg-[#ffdf58] text-base font-black text-[#17104f] shadow-[3px_3px_0_#17104f] disabled:opacity-40"
						>
							▶
						</button>
					</div>
				</div>

				<div className="mt-1 flex justify-center gap-2">
					<button
						onClick={
							togglePause
						}
						disabled={
							!started ||
							game.gameOver
						}
						className="rounded-lg border-2 border-[#17104f] bg-[#ffdf58] px-4 py-1 text-[10px] font-black text-[#17104f] shadow-[3px_3px_0_#17104f] disabled:opacity-40"
					>
						{paused
							? "RESUME"
							: "PAUSE"}
					</button>

					<button
						onClick={
							restartGame
						}
						className="rounded-lg border-2 border-[#17104f] bg-[#ff4f9a] px-4 py-1 text-[10px] font-black text-white shadow-[3px_3px_0_#17104f]"
					>
						RESTART
					</button>
				</div>
			</div>

			{/* ========================================================= */}
			{/* EXIT BUTTON */}
			{/* ========================================================= */}

			<button
				onClick={() => router.push("/hangout/gaming")}
				className="
					absolute
					bottom-3
					right-3
					z-50
					rounded-lg
					border-2
					border-[#17104f]
					bg-[#17104f]
					px-4
					py-2
					text-[10px]
					font-black
					text-white
					shadow-[3px_3px_0_#ff4f9a]
					transition
					hover:bg-[#ff4f9a]
					active:translate-x-[1px]
					active:translate-y-[1px]
					sm:bottom-5
					sm:right-6
					sm:px-5
					sm:py-2.5
					sm:text-xs
				"
			>
				EXIT
			</button>
		</div>
	);
}