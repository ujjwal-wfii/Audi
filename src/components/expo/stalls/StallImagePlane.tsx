"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { retainMediaUrl } from "./stallMediaUrls";

type StallImagePlaneProps = {
    url: string;
    position: [number, number, number];
    rotation?: [number, number, number];
    size: [number, number];
};

/** Draw one uploaded image on top of an existing media placeholder. */
export default function StallImagePlane({
    url,
    position,
    rotation = [0, 0, 0],
    size,
}: StallImagePlaneProps) {
    const [loaded, setLoaded] = useState<{
        url: string;
        texture: THREE.Texture;
    } | null>(null);
    const [width, height] = size;

    useEffect(() => {
        let active = true;
        const release = retainMediaUrl(url);
        const loader = new THREE.TextureLoader();
        const texture = loader.load(
            url,
            (imageTexture) => {
                if (!active) {
                    imageTexture.dispose();
                    return;
                }

                imageTexture.colorSpace = THREE.SRGBColorSpace;
                imageTexture.anisotropy = 4;

                // Center-crop to fill the panel without stretching the image.
                const image = imageTexture.image as HTMLImageElement;
                const imageWidth = image.naturalWidth || image.width;
                const imageHeight = image.naturalHeight || image.height;
                if (imageWidth > 0 && imageHeight > 0 && height > 0) {
                    const imageRatio = imageWidth / imageHeight;
                    const panelRatio = width / height;
                    if (imageRatio > panelRatio) {
                        const visibleWidth = panelRatio / imageRatio;
                        imageTexture.repeat.set(visibleWidth, 1);
                        imageTexture.offset.set((1 - visibleWidth) / 2, 0);
                    } else {
                        const visibleHeight = imageRatio / panelRatio;
                        imageTexture.repeat.set(1, visibleHeight);
                        imageTexture.offset.set(0, (1 - visibleHeight) / 2);
                    }
                }
                imageTexture.needsUpdate = true;
                setLoaded({ url, texture: imageTexture });
            },
            undefined,
            (error) => {
                if (active) console.error("Could not load stall image:", error);
            },
        );

        return () => {
            active = false;
            texture.dispose();
            release();
        };
    }, [url, width, height]);

    if (!loaded || loaded.url !== url) return null;

    return (
        <mesh position={position} rotation={rotation}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial map={loaded.texture} toneMapped={false} />
        </mesh>
    );
}
