"use client";

interface LikeButtonProps {
	likesCount: number;
	likedByMe: boolean;
	disabled?: boolean;
	onToggle: () => void;
}

export function LikeButton({
	likesCount,
	likedByMe,
	disabled,
	onToggle,
}: LikeButtonProps) {
	return (
		<button
			type="button"
			onClick={onToggle}
			disabled={disabled}
			aria-pressed={likedByMe}
			aria-label={
				likedByMe ? "Unlike this feedback" : "Like this feedback"
			}
			className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
				likedByMe
					? "border-rose-300 bg-rose-50 text-rose-600"
					: "border-stone-300 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-600"
			}`}
		>
			<svg
				viewBox="0 0 24 24"
				className="h-4 w-4"
				fill={likedByMe ? "currentColor" : "none"}
				stroke="currentColor"
				strokeWidth={2}
				aria-hidden
			>
				<path d="M12 21s-6.7-4.35-9.3-8.1C.7 10 1.4 6.4 4.6 5.1c2-.8 4 .1 5.4 2 .4.5.6.9 2 2.4 1.4-1.5 1.6-1.9 2-2.4 1.4-1.9 3.4-2.8 5.4-2 3.2 1.3 3.9 4.9 1.9 7.8C18.7 16.65 12 21 12 21z" />
			</svg>
			{likesCount}
		</button>
	);
}
