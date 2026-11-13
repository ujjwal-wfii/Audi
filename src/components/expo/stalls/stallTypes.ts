import type { Stall } from "@/lib/expo/layout/schema";

export type StallMediaSlot =
	| "left_wall"
	| "right_wall"
	| "front_desk"
	| "back_screen";

export type StallMediaItem = {
	url: string;
	type: "image" | "video";
};

export type StallMedia = Partial<
	Record<StallMediaSlot, StallMediaItem>
>;

export type StallVisualProps = {
	stall: Stall;
	rotationY: number;
	size: [number, number, number];
	color: string;
	media?: StallMedia;
};

export type { Stall };
