"use client";
import { create } from "zustand";
import type { StallMedia, StallMediaItem, StallMediaSlot } from "./stallTypes";
import { retainMediaUrl } from "./stallMediaUrls";

const storedUrlReleases = new Map<string, () => void>();

export type StallMediaState = {
    mediaByStall: Record<string, StallMedia>;
    setMedia: (stallId: string, slot: StallMediaSlot, item: StallMediaItem) => void;
    setImage: (stallId: string, slot: StallMediaSlot, url: string) => void;
    removeImage: (stallId: string, slot: StallMediaSlot) => void;
};
// Shared across client-side routes. URLs remain valid while this tab is open.
export const useStallMediaStore = create<StallMediaState>((set, get) => ({
    mediaByStall: {},
    setImage: (stallId, slot, url) => get().setMedia(stallId, slot, { url, type: "image" }),
    setMedia: (stallId, slot, item) => {
        if (item.type === "video" && slot !== "back_screen") {
            throw new Error("Videos are supported on the back screen only.");
        }
        set((state) => {
            const key = `${stallId}:${slot}`;
            const release = retainMediaUrl(item.url);
            storedUrlReleases.get(key)?.();
            storedUrlReleases.set(key, release);
            return { mediaByStall: { ...state.mediaByStall,
                [stallId]: { ...state.mediaByStall[stallId], [slot]: item },
            } };
        });
    },
    removeImage: (stallId, slot) => set((state) => {
        const media = { ...state.mediaByStall[stallId] };
        const key = `${stallId}:${slot}`;
        storedUrlReleases.get(key)?.();
        storedUrlReleases.delete(key);
        delete media[slot];
        return { mediaByStall: { ...state.mediaByStall, [stallId]: media } };
    }),
}));
/** Decode first so an invalid image cannot replace a working preview. */
export async function uploadStallImage(stallId: string, slot: StallMediaSlot, file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Choose a JPG, PNG, or WebP image.");
    }
    if (file.size > 1 * 1024 * 1024) throw new Error("Choose an image up to 1 MB.");
    const url = URL.createObjectURL(file);
    const release = retainMediaUrl(url);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        useStallMediaStore.getState().setImage(stallId, slot, url);
    } catch {
        throw new Error("This image could not be opened. Please choose another file.");
    } finally {
        release();
    }
}

/** A temporary decoder validates the first video frame before replacing media. */
async function validateVideo(url: string) {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let onReady: () => void = () => {};
    let onError: () => void = () => {};
    try {
        await new Promise<void>((resolve, reject) => {
            onError = () => reject(new Error("This video could not be opened. Try another MP4 or WebM file."));
            onReady = () => video.videoWidth > 0 && video.videoHeight > 0 ? resolve() : onError();
            video.addEventListener("loadeddata", onReady);
            video.addEventListener("error", onError);
            timeout = setTimeout(onError, 15000);
            video.src = url;
            video.load();
        });
    } finally {
        clearTimeout(timeout);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("error", onError);
        video.pause();
        video.removeAttribute("src");
        video.load();
    }
}

export async function uploadStallMedia(stallId: string, slot: StallMediaSlot, file: File) {
    const isVideo = ["video/mp4", "video/webm"].includes(file.type);
    if (!isVideo) return uploadStallImage(stallId, slot, file);
    if (slot !== "back_screen") throw new Error("Videos are supported on the back screen only.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Choose a video up to 10 MB.");
    const url = URL.createObjectURL(file);
    const release = retainMediaUrl(url);
    try {
        await validateVideo(url);
        useStallMediaStore.getState().setMedia(stallId, slot, { url, type: "video" });
    } finally {
        release();
    }
}
