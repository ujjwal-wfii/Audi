import Link from "next/link";
import {
	Gamepad2,
	Grid3X3,
	Hash,
	Trophy,
	Zap,
} from "lucide-react";

import { Leaderboard } from "@/components/gaming/LeaderBoard";
import { FootballIntro } from "@/components/gaming/FootballIntro";

const games = [
	{
		name: "Snake",
		description: "Eat, grow, and beat your high score.",
		icon: Zap,
		href: "/hangout/gaming/snake",
	},
	{
		name: "Sudoku",
		description: "Test your logic and solve the puzzle.",
		icon: Hash,
		href: "/hangout/gaming/sudoku",
	},
	{
		name: "Tic-Tac-Toe",
		description: "Get three in a row and win the game.",
		icon: Grid3X3,
		href: "/hangout/gaming/tic-tac-toe",
	},
	{
		name: "Game 4",
		description: "A new game is coming soon.",
		icon: Gamepad2,
		href: "#",
		comingSoon: true,
	},
];

export function GamingZone() {
	return (
		<div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-[clamp(1rem,3vh,2rem)] text-white sm:px-6">
			<FootballIntro />
			{/* Header */}
			<div className="mb-[clamp(0.75rem,2vh,1.5rem)] flex shrink-0 items-center justify-between gap-3">
				<div className="min-w-0">
					<h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold">
						Gaming Zone
					</h1>

					<p className="mt-1 text-[clamp(0.7rem,1.2vw,0.875rem)] text-slate-400">
						Choose a game and have some fun.
					</p>
				</div>

				{/* Mobile / Tablet Leaderboard Button */}
				<Link
					href="/hangout/gaming/leaderboard"
					className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10 sm:px-4 sm:text-sm lg:hidden"
				>
					<Trophy className="h-4 w-4" />
					<span>Leaderboard</span>
				</Link>
			</div>

			{/* Main Dashboard */}
			<div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
				{/* Desktop Leaderboard */}
				<aside className="hidden min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] lg:block">
					<div className="h-full overflow-y-auto">
						<Leaderboard />
					</div>
				</aside>

				{/* Games */}
				<div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-[clamp(0.5rem,1.5vw,1rem)]">
					{games.map((game) => {
						const Icon = game.icon;

						const card = (
							<div
								className={`group relative flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-[clamp(0.75rem,2vw,1.5rem)] transition sm:rounded-2xl ${
									game.comingSoon
										? "opacity-60"
										: "hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-white/[0.07]"
								}`}
								style={
									game.name === "Snake"
										? {
												backgroundImage:
													"linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), url('/Snake-Game.png')",
												backgroundSize: "cover",
												backgroundPosition: "center",
											}
											: game.name === "Sudoku"
											? {
													backgroundImage:
														"linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), url('/Sudoku-Game.png')",
													backgroundSize: "cover",
													backgroundPosition: "center",
												}
											: game.name === "Tic-Tac-Toe"
												? {
													backgroundImage:
														"linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)), url('/Tic-Tac-Toe.png')",
													backgroundSize: "cover",
													backgroundPosition: "center",
												}
											: undefined
								}							>
								{/* Icon */}
								<div className="flex h-[clamp(2.5rem,6vw,3.5rem)] w-[clamp(2.5rem,6vw,3.5rem)] items-center justify-center rounded-lg border border-white/10 bg-white/5 sm:rounded-xl">
									<Icon className="h-[clamp(1.25rem,3vw,1.75rem)] w-[clamp(1.25rem,3vw,1.75rem)] text-cyan-400" />
								</div>

								{/* Content */}
								<div className="mt-3 sm:mt-5">
									<h2 className="text-[clamp(0.9rem,2vw,1.25rem)] font-semibold">
										{game.name}
									</h2>

									<p className="mt-1 max-w-sm text-[clamp(0.65rem,1.2vw,0.875rem)] leading-relaxed text-slate-400">
										{game.description}
									</p>
								</div>

								{/* Status */}
								{game.comingSoon ? (
									<span className="absolute right-3 top-3 rounded-full border border-white/10 px-2 py-1 text-[0.6rem] text-slate-400 sm:right-5 sm:top-5 sm:px-3 sm:text-xs">
										Coming Soon
									</span>
								) : (
									<span className="absolute bottom-3 right-3 text-xs text-slate-500 transition group-hover:text-cyan-400 sm:bottom-5 sm:right-5 sm:text-sm">
										Play →
									</span>
								)}
							</div>
						);

						if (game.comingSoon) {
							return (
								<div
									key={game.name}
									className="min-h-0"
								>
									{card}
								</div>
							);
						}

						return (
							<Link
								key={game.name}
								href={game.href}
								className="min-h-0"
							>
								{card}
							</Link>
						);
					})}
				</div>
			</div>
		</div>
	);
}