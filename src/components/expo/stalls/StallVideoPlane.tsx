"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { retainMediaUrl } from "./stallMediaUrls";

type StallVideoPlaneProps = {
    url: string;
    position: [number, number, number];
    size: [number, number];
};

/** Each mounted back screen owns its video decoder and texture. */
export default function StallVideoPlane({ url, position, size }: StallVideoPlaneProps) {
    const [loaded, setLoaded] = useState<{ url: string; texture: THREE.VideoTexture } | null>(null);
    const [width, height] = size;

    useEffect(() => {
        let active = true;
        const release = retainMediaUrl(url);
        const video = document.createElement("video");
        video.muted = true;
        video.defaultMuted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = "auto";
        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace;

        const onReady = () => {
            if (!active || video.videoWidth <= 0 || video.videoHeight <= 0) return;
            // Match the image renderer's centered crop without changing the screen.
            const imageRatio = video.videoWidth / video.videoHeight;
            const panelRatio = width / height;
            if (imageRatio > panelRatio) {
                const visibleWidth = panelRatio / imageRatio;
                texture.repeat.set(visibleWidth, 1);
                texture.offset.set((1 - visibleWidth) / 2, 0);
            } else {
                const visibleHeight = imageRatio / panelRatio;
                texture.repeat.set(1, visibleHeight);
                texture.offset.set(0, (1 - visibleHeight) / 2);
            }
            texture.needsUpdate = true;
            setLoaded({ url, texture });
        };
        const onError = () => {
            if (active) console.error("Could not load stall video:", video.error);
        };
        video.addEventListener("loadeddata", onReady);
        video.addEventListener("error", onError);
        video.src = url;
        void video.play().catch((error: unknown) => {
            if (active) console.error("Could not autoplay stall video:", error);
        });

        return () => {
            active = false;
            video.removeEventListener("loadeddata", onReady);
            video.removeEventListener("error", onError);
            video.pause();
            texture.dispose(); // Also cancels Three.js video frame callbacks.
            video.removeAttribute("src");
            video.load();
            release();
        };
    }, [url, width, height]);

    if (!loaded || loaded.url !== url) return null;
    return (
        <mesh position={position}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial map={loaded.texture} toneMapped={false} />
        </mesh>
    );
}
