/**
 * Pure range logic (no React / three.js), so it is easy to test.
 *
 * Each stall gets an interaction zone in FRONT of it: as wide as the stall
 * (plus a small side margin) and ENTER_DISTANCE deep, measured from the front edge.
 */
export const ENTER_DISTANCE = 2; // metres from the stall front to start interacting
export const EXIT_DISTANCE = 4; // metres to lose it again (hysteresis, stops flicker)
export const SIDE_MARGIN = 0.5; // metres beyond the stall's left/right edges
const SWITCH_ADVANTAGE = 0.75; // a different stall must be this much closer to steal focus

export type ProximityStall = {
	id: string;
	type: string;
	footprintX: [number, number];
	footprintZ: [number, number];
	front: 1 | -1; // +1 = opens toward +z, -1 = opens toward -z
};

/** Distance from (px,pz) to the stall's front zone, or null if outside it. */
export function frontZoneDistance(
	px: number,
	pz: number,
	s: ProximityStall,
	range: number,
	sideMargin: number,
): number | null {
	const [minX, maxX] = s.footprintX;
	const [minZ, maxZ] = s.footprintZ;
	const dx = px < minX ? minX - px : px > maxX ? px - maxX : 0; // how far outside the stall's width
	if (dx > sideMargin) return null;
	const frontEdge = s.front === 1 ? maxZ : minZ;
	const depth = (pz - frontEdge) * s.front; // >0 = on the open side
	if (depth < 0 || depth > range) return null;
	return Math.hypot(depth, dx);
}

/** Picks the one stall the player is "at", or null. */
export function resolveActiveStall(
	px: number,
	pz: number,
	stalls: ProximityStall[],
	currentId: string | null,
): ProximityStall | null {
	let current: { stall: ProximityStall; score: number } | null = null;
	let best: { stall: ProximityStall; score: number } | null = null;

	for (const stall of stalls) {
		const isCurrent = stall.id === currentId;
		const score = frontZoneDistance(
			px,
			pz,
			stall,
			isCurrent ? EXIT_DISTANCE : ENTER_DISTANCE,
			isCurrent ? SIDE_MARGIN * 2 : SIDE_MARGIN,
		);
		if (score === null) continue;
		if (isCurrent) current = { stall, score };
		if (!best || score < best.score) best = { stall, score };
	}

	if (
		current &&
		best &&
		best.stall.id !== current.stall.id &&
		best.score < current.score - SWITCH_ADVANTAGE
	) {
		return best.stall;
	}
	return current ? current.stall : best ? best.stall : null;
}
