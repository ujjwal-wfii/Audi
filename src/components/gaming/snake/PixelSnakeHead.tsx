interface PixelSnakeHeadProps {
	direction: "UP" | "DOWN" | "LEFT" | "RIGHT";
}

export function PixelSnakeHead({
	direction,
}: PixelSnakeHeadProps) {
	const rotation = {
		RIGHT: "rotate-0",
		DOWN: "rotate-90",
		LEFT: "rotate-180",
		UP: "-rotate-90",
	}[direction];

	return (
		<div
			className={`relative h-full w-full ${rotation}`}
		>
			{/* Head */}
			<div className="absolute inset-[4%] rounded-[38%] bg-[#69e51b] shadow-[inset_-4px_-4px_0_#3ca900]">
				{/* Eyes */}
				<div className="absolute left-[18%] top-[20%] h-[24%] w-[24%] rounded-[25%] bg-white">
					<div className="absolute right-[15%] top-[20%] h-[45%] w-[45%] rounded-full bg-[#17104f]" />
				</div>

				<div className="absolute right-[18%] top-[20%] h-[24%] w-[24%] rounded-[25%] bg-white">
					<div className="absolute left-[15%] top-[20%] h-[45%] w-[45%] rounded-full bg-[#17104f]" />
				</div>

				{/* Cheeks */}
				<div className="absolute bottom-[30%] left-[8%] h-[12%] w-[20%] rounded-full bg-[#ff6682]" />

				<div className="absolute bottom-[30%] right-[8%] h-[12%] w-[20%] rounded-full bg-[#ff6682]" />

				{/* Mouth */}
				<div className="absolute bottom-[20%] left-[36%] h-[7%] w-[28%] rounded-full bg-[#17104f]" />
			</div>
		</div>
	);
}