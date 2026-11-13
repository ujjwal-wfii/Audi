"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useLayoutEffect } from "react";
import SmallStall from "../stalls/SmallStall";
import { hallLayout, SMALL_STALL_COLOR } from "../stalls/stallLayout";
import type { Stall, StallMedia, StallMediaSlot } from "../stalls/stallTypes";
const views: Record<StallMediaSlot, [number, number, number]> = {
    left_wall: [1, 3, 9], right_wall: [-1, 3, 9],
    front_desk: [4, 3.5, 10], back_screen: [0, 3, 10],
};
function PreviewCamera({ slot }: { slot: StallMediaSlot }) {
    const camera = useThree((state) => state.camera);
    useLayoutEffect(() => {
        camera.position.set(...views[slot]);
        camera.lookAt(0, 2, 0);
    }, [camera, slot]);
    return null;
}
export default function StallPreview({ stall, media, slot }: {
    stall: Stall; media?: StallMedia; slot: StallMediaSlot;
}) {
    return (
        <Canvas camera={{ position: views[slot], fov: 48, near: 0.1, far: 60 }}
            dpr={[1, 1.5]} gl={{ antialias: true }} aria-label={`Interactive 3D preview of stall ${stall.id}`}>
            <color attach="background" args={["#dce6ef"]} />
            <ambientLight intensity={1.25} />
            <hemisphereLight args={["#ffffff", "#9ca3af", 1]} />
            <directionalLight position={[8, 12, 10]} intensity={1.8} />
            <Suspense fallback={null}>
                <SmallStall stall={stall} rotationY={0} size={hallLayout.stall_sizes.small}
                    color={SMALL_STALL_COLOR} media={media} />
            </Suspense>
            <PreviewCamera slot={slot} />
            <OrbitControls key={`${stall.id}:${slot}`} makeDefault target={[0, 2, 0]} minDistance={3} maxDistance={10}
                maxPolarAngle={Math.PI / 2} enablePan={false} />
            {/* <gridHelper args={[16, 16, "#a3b6c4", "#c7d4df"]} position={[0, -0.01, 0]} /> */}
        </Canvas>
    );
}
