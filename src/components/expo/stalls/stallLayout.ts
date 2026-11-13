import hallLayoutJson from "@/lib/expo/layout/hall-layout.json";
import type { HallLayout, Stall } from "@/lib/expo/layout/schema";
export const hallLayout = hallLayoutJson as HallLayout;
export const smallStalls = hallLayout.stalls.filter((stall) => stall.type === "small");
export const SMALL_STALL_COLOR = "#2F7F7B";

type StallFrontDirection = "positive-z" | "negative-z";

const explicitStallFrontDirections: Record<string, StallFrontDirection> = {
	S11: "negative-z",
	S12: "negative-z",
	S13: "negative-z",
	S14: "negative-z",
	S15: "negative-z",
	S16: "negative-z",
	S17: "negative-z",
	S18: "negative-z",
	S19: "negative-z",
	S20: "negative-z",
	SP3: "negative-z",
	SP4: "negative-z",
	L3: "negative-z",
	L4: "negative-z",
	M11: "negative-z",
	M12: "negative-z",
	M13: "negative-z",
	M14: "negative-z",
};

export function getStallRotation(stall: Stall) {
    return explicitStallFrontDirections[stall.id] === "negative-z" ? Math.PI : 0;
}
export function getSmallStall(id?: string | null) {
    return smallStalls.find((stall) => stall.id === id);
}
/** Start in the aisle outside the entrance, facing the selected stall. */
export function getStallArrival(stall?: Stall) {
    if (!stall) return { position: hallLayout.player_spawn.position, yaw: 0 };
    const reversed = getStallRotation(stall) !== 0;
    const z = reversed ? stall.footprint_z[0] - 5.4 : stall.footprint_z[1] + 5.4;
    
    return { position: [stall.center[0], 0, z] as [number, number, number], yaw: reversed ? Math.PI : 0 };
}
