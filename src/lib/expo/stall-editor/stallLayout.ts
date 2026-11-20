import hallLayoutJson from "@/lib/expo/layout/hall-layout.json";
import type { HallLayout, Stall } from "@/lib/expo/layout/schema";
export const hallLayout = hallLayoutJson as any as HallLayout;
export const smallStalls = hallLayout.stalls.filter(
	(stall) => stall.type === "small",
);
export const SMALL_STALL_COLOR = "#2F7F7B";

export function getSmallStall(id?: string | null) {
	return smallStalls.find((stall) => stall.id === id);
}
