import type { Stall } from "@/lib/expo/layout/schema";

export type StallVisualProps = {
	stall: Stall;
	rotationY: number;
	size: [number, number, number];
	color: string;
};

export type { Stall };
