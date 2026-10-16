"use client";

import type { FoodType } from "@/lib/games/snake/snakeEngine";

interface PixelFoodProps {
	type: FoodType;
}

export function PixelFood({ type }: PixelFoodProps) {
	if (type === "apple") {
		return (
			<div className="relative h-[72%] w-[72%]">
				{/* Stem */}
				<div className="absolute left-[48%] top-[-12%] h-[25%] w-[14%] bg-[#17104f]" />

				{/* Leaf */}
				<div className="absolute right-[8%] top-[-4%] h-[22%] w-[35%] rotate-[-20deg] bg-[#39d353]" />

				{/* Apple */}
				<div className="absolute bottom-[5%] left-[8%] h-[78%] w-[84%] rounded-[38%] bg-[#ff245c] shadow-[inset_-3px_-3px_0_#b81447]" />

				{/* Highlight */}
				<div className="absolute left-[24%] top-[30%] h-[18%] w-[13%] bg-white" />
			</div>
		);
	}

	if (type === "grapes") {
		return (
			<div className="relative h-[78%] w-[72%]">
				{/* Stem */}
				<div className="absolute left-[47%] top-0 h-[25%] w-[12%] bg-[#17104f]" />

				{/* Leaf */}
				<div className="absolute right-[0%] top-[4%] h-[28%] w-[45%] rotate-[25deg] bg-[#31d45b]" />

				{/* Grapes */}
				<div className="absolute bottom-0 left-[12%] grid w-[76%] grid-cols-3 gap-[4%]">
					{Array.from({ length: 10 }).map((_, index) => (
						<div
							key={index}
							className="aspect-square rounded-full bg-[#8b22d9] shadow-[inset_-2px_-2px_0_#54128e]"
						/>
					))}
				</div>
			</div>
		);
	}

	if (type === "carrot") {
		return (
			<div className="relative h-[78%] w-[72%] rotate-[-35deg]">
				{/* Leaves */}
				<div className="absolute left-[34%] top-0 h-[28%] w-[18%] bg-[#39d353]" />
				<div className="absolute left-[50%] top-[3%] h-[25%] w-[18%] rotate-[30deg] bg-[#20b84b]" />
				<div className="absolute left-[20%] top-[8%] h-[23%] w-[18%] rotate-[-25deg] bg-[#49e45e]" />

				{/* Carrot */}
				<div className="absolute bottom-[2%] left-[25%] h-[72%] w-[50%] rounded-b-[45%] rounded-t-[15%] bg-[#ff7a19] shadow-[inset_-3px_-3px_0_#c84c0c]" />

				{/* Highlight */}
				<div className="absolute bottom-[42%] left-[38%] h-[10%] w-[12%] rotate-[20deg] bg-[#ffd29a]" />
			</div>
		);
	}

	/* Star */
	return (
		<div className="relative h-[80%] w-[80%]">
			<div
				className="absolute inset-0 bg-[#ffe019]"
				style={{
					clipPath:
						"polygon(50% 0%, 61% 34%, 98% 36%, 69% 57%, 79% 94%, 50% 72%, 21% 94%, 31% 57%, 2% 36%, 39% 34%)",
				}}
			/>

			<div
				className="absolute inset-[14%] bg-[#fff56b]"
				style={{
					clipPath:
						"polygon(50% 0%, 61% 34%, 98% 36%, 69% 57%, 79% 94%, 50% 72%, 21% 94%, 31% 57%, 2% 36%, 39% 34%)",
				}}
			/>
		</div>
	);
}