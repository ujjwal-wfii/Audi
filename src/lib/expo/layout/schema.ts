export type StallType = "small" | "medium" | "large" | "special";

export type Stall = {
	id: string;
	type: StallType;
	center: [number, number, number];
	footprint_x: [number, number];
	footprint_z: [number, number];
	entrance_direction: string;
};

export type HallPath = {
	id: string;
	center: [number, number, number];
	size: [number, number, number];
	footprint_x: [number, number];
	footprint_z: [number, number];
	purpose: string;
};

export type HallLayout = {
	units: "meters" | string;
	coordinate_system: {
		x: string;
		y: string;
		z: string;
		origin: string;
	};
	hall: {
		min: { x: number; y: number; z: number };
		max: { x: number; y: number; z: number };
		width: number;
		depth: number;
		ceiling_height: number;
		floor_center: [number, number, number];
		floor_size: [number, number, number];
	};
	player_spawn: {
		position: [number, number, number];
		facing: string;
	};
	stall_sizes: Record<StallType, [number, number, number]>;
	stalls: Stall[];
	paths: HallPath[];
	streaming_zones: Array<{
		id: string;
		bounds: { x: [number, number]; z: [number, number] };
		priority: string;
	}>;
	notes: string[];
};

export type LayoutIssue = {
	severity: "error" | "warning";
	code: string;
	message: string;
};
