import type { HallLayout, LayoutIssue } from "./schema";

const EPSILON = 1e-6;

function intersects(
	ax: [number, number],
	az: [number, number],
	bx: [number, number],
	bz: [number, number],
) {
	return (
		Math.min(ax[1], bx[1]) - Math.max(ax[0], bx[0]) > EPSILON &&
		Math.min(az[1], bz[1]) - Math.max(az[0], bz[0]) > EPSILON
	);
}

/**
 * Validates the layout without silently changing the supplied coordinates.
 * Stall/path intersections are warnings because some paths may intentionally
 * represent walkable aprons; review them in the 2D preview.
 */
export function validateHallLayout(layout: HallLayout): LayoutIssue[] {
	const issues: LayoutIssue[] = [];
	const expected = { small: 20, medium: 14, large: 5, special: 4 };
	const counts = { small: 0, medium: 0, large: 0, special: 0 };
	const ids = new Set<string>();

	if (layout.stalls.length !== 43) {
		issues.push({
			severity: "error",
			code: "STALL_COUNT",
			message: `Expected 43 stalls; found ${layout.stalls.length}.`,
		});
	}

	for (const stall of layout.stalls) {
		counts[stall.type] += 1;

		if (ids.has(stall.id)) {
			issues.push({
				severity: "error",
				code: "DUPLICATE_STALL_ID",
				message: `Duplicate stall ID "${stall.id}".`,
			});
		}
		ids.add(stall.id);

		const [minX, maxX] = stall.footprint_x;
		const [minZ, maxZ] = stall.footprint_z;
		if (minX >= maxX || minZ >= maxZ) {
			issues.push({
				severity: "error",
				code: "INVALID_FOOTPRINT",
				message: `${stall.id} has an invalid footprint.`,
			});
		}

		if (
			minX < layout.hall.min.x - EPSILON ||
			maxX > layout.hall.max.x + EPSILON ||
			minZ < layout.hall.min.z - EPSILON ||
			maxZ > layout.hall.max.z + EPSILON
		) {
			issues.push({
				severity: "error",
				code: "STALL_OUT_OF_BOUNDS",
				message: `${stall.id} extends outside the hall boundary.`,
			});
		}
	}

	for (const type of ["small", "medium", "large", "special"] as const) {
		if (counts[type] !== expected[type]) {
			issues.push({
				severity: "error",
				code: "STALL_TYPE_COUNT",
				message: `Expected ${expected[type]} ${type} stalls; found ${counts[type]}.`,
			});
		}
	}

	for (let i = 0; i < layout.stalls.length; i += 1) {
		const a = layout.stalls[i];
		for (let j = i + 1; j < layout.stalls.length; j += 1) {
			const b = layout.stalls[j];
			if (
				intersects(
					a.footprint_x,
					a.footprint_z,
					b.footprint_x,
					b.footprint_z,
				)
			) {
				issues.push({
					severity: "error",
					code: "STALL_OVERLAP",
					message: `${a.id} overlaps ${b.id}.`,
				});
			}
		}
	}

	for (const stall of layout.stalls) {
		for (const path of layout.paths) {
			if (
				intersects(
					stall.footprint_x,
					stall.footprint_z,
					path.footprint_x,
					path.footprint_z,
				)
			) {
				issues.push({
					severity: "warning",
					code: "STALL_PATH_INTERSECTION",
					message: `${stall.id} intersects walkable path "${path.id}". Review the top-down preview; this may be an intentional apron or a layout error.`,
				});
			}
		}
	}

	const spawn = layout.player_spawn.position;
	if (
		spawn[0] < layout.hall.min.x ||
		spawn[0] > layout.hall.max.x ||
		spawn[2] < layout.hall.min.z ||
		spawn[2] > layout.hall.max.z
	) {
		issues.push({
			severity: "error",
			code: "SPAWN_OUT_OF_BOUNDS",
			message: "Player spawn is outside the hall boundary.",
		});
	}

	return issues;
}
