"use client";

import { interactionStore } from "@/lib/expo/stall-interactivity/interactionStore";
import {
	ENTER_DISTANCE,
	ProximityStall,
	resolveActiveStall,
} from "@/lib/expo/stall-interactivity/stallProximity";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";

type LayoutStall = {
	id: string;
	type: string;
	footprint_x: number[];
	footprint_z: number[];
};

type Props = {
	stalls: LayoutStall[];
	/** +1 if the stall opens toward +z, -1 if toward -z. */
	frontOf: (stall: LayoutStall) => 1 | -1;
	/** Draw the interaction zones on the floor so you can check them visually. */
	debug?: boolean;
};

/**
 * Mount once inside <Canvas>. Checks the player (camera) position ~10 times a second
 * and tells the interaction store which stall, if any, the player is standing at.
 */
export default function StallProximityTracker({
	stalls,
	frontOf,
	debug = false,
}: Props) {
	const { camera } = useThree();
	const elapsed = useRef(0);

	const items = useMemo<ProximityStall[]>(
		() =>
			stalls.map((s) => ({
				id: s.id,
				type: s.type,
				footprintX: [s.footprint_x[0], s.footprint_x[1]],
				footprintZ: [s.footprint_z[0], s.footprint_z[1]],
				front: frontOf(s),
			})),
		[stalls, frontOf],
	);

	useFrame((_, delta) => {
		elapsed.current += delta;
		if (elapsed.current < 0.1) return; // 10 Hz is plenty for proximity
		elapsed.current = 0;
		const { panelOpen, activeStall } = interactionStore.getState();
		const hit = resolveActiveStall(
			camera.position.x,
			camera.position.z,
			items,
			activeStall?.id ?? null,
		);
		if (panelOpen) {
			if (hit?.id === activeStall?.id) return;
			interactionStore.closePanel();
		}
		interactionStore.setActiveStall(
			hit ? { id: hit.id, type: hit.type } : null,
		);
	});

	if (!debug) return null;
	return (
		<group>
			{items.map((s) => {
				const w = s.footprintX[1] - s.footprintX[0];
				const cx = (s.footprintX[0] + s.footprintX[1]) / 2;
				const frontEdge =
					s.front === 1 ? s.footprintZ[1] : s.footprintZ[0];
				return (
					<mesh
						key={s.id}
						position={[
							cx,
							0.06,
							frontEdge + (s.front * ENTER_DISTANCE) / 2,
						]}
						rotation={[-Math.PI / 2, 0, 0]}
						raycast={() => null}
					>
						<planeGeometry args={[w, ENTER_DISTANCE]} />
						<meshBasicMaterial
							color="#14b8a6"
							transparent
							opacity={0.35}
							depthWrite={false}
						/>
					</mesh>
				);
			})}
		</group>
	);
}
