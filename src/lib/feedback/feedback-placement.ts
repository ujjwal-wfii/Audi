import {
	NOTE_COLORS,
	NOTE_FOOTPRINT,
	NotePosition,
	NoteVisual,
	TapePosition,
	WALL_BOUNDS,
} from "@/types/feedback";

const TAPE_POSITIONS: TapePosition[] = ["left", "center", "right"];

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function pickRandom<T>(arr: readonly T[]): T {
	const item = arr[Math.floor(Math.random() * arr.length)];
	return item as T;
}

/**
 * Generates the five visual properties that are allowed to vary between
 * notes: color, rotation, shadow strength, tape position — position is
 * generated separately by `findPlacement` because it needs to know about
 * already-placed notes.
 *
 * Called exactly ONCE, at creation time, and persisted. Never call this
 * again for an existing note (e.g. on edit) or its appearance will change.
 */
export function generateNoteVisual(): NoteVisual {
	return {
		color: pickRandom(NOTE_COLORS),
		rotation: Number(randomBetween(-4, 4).toFixed(2)),
		shadowStrength: Number(randomBetween(0.35, 0.85).toFixed(2)),
		tapePosition: pickRandom(TAPE_POSITIONS),
	};
}

interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

function toRect(pos: NotePosition): Rect {
	return {
		x: pos.x - NOTE_FOOTPRINT.width / 2,
		y: pos.y - NOTE_FOOTPRINT.height / 2,
		width: NOTE_FOOTPRINT.width,
		height: NOTE_FOOTPRINT.height,
	};
}

/** Fraction of each note's area that is allowed to overlap another note. */
const MAX_OVERLAP_RATIO = 0.2;

function overlapRatio(a: Rect, b: Rect): number {
	const xOverlap = Math.max(
		0,
		Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
	);
	const yOverlap = Math.max(
		0,
		Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
	);
	const overlapArea = xOverlap * yOverlap;
	const areaA = a.width * a.height;
	return areaA > 0 ? overlapArea / areaA : 0;
}

function randomCandidate(): NotePosition {
	return {
		x: randomBetween(WALL_BOUNDS.minX, WALL_BOUNDS.maxX),
		y: randomBetween(WALL_BOUNDS.minY, WALL_BOUNDS.maxY),
	};
}

/**
 * Finds a normalized wall position for a new note. Retries a bounded
 * number of times to avoid heavy overlap with existing notes, then falls
 * back to the least-bad candidate seen. This is intentionally lightweight
 * (no physics engine) — some organic overlap is fine and expected.
 */
export function findPlacement(
	existing: NotePosition[],
	attempts = 24,
): NotePosition {
	const existingRects = existing.map(toRect);

	let best: { pos: NotePosition; worstOverlap: number } | null = null;

	for (let i = 0; i < attempts; i++) {
		const candidate = randomCandidate();
		const candidateRect = toRect(candidate);

		const worstOverlap = existingRects.reduce(
			(max, rect) => Math.max(max, overlapRatio(candidateRect, rect)),
			0,
		);

		if (worstOverlap <= MAX_OVERLAP_RATIO) {
			return candidate;
		}

		if (!best || worstOverlap < best.worstOverlap) {
			best = { pos: candidate, worstOverlap };
		}
	}

	// No ideal spot found within the retry budget — use the best candidate seen.
	return best ? best.pos : randomCandidate();
}
