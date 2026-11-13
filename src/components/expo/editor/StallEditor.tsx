"use client";

import Link from "next/link";
import { useState } from "react";
import { getSmallStall, smallStalls } from "../stalls/stallLayout";
import { uploadStallMedia, useStallMediaStore } from "../stalls/stallMediaStore";
import type { StallMediaSlot } from "../stalls/stallTypes";
import StallPreview from "./StallPreview";

/*
  Palette (from the Petra reference)
  skin   #E8BEAC  primary actions, focus
  umber  #5C2018  editor panel background
  clay   #BC4639  accents, errors, remove action
  rose   #D4A59A  borders, secondary text
  blush  #F3E0DC  preview background, main text on umber
*/

const slots: { value: StallMediaSlot; label: string }[] = [
    { value: "back_screen", label: "Back screen" },
    { value: "left_wall", label: "Left wall" },
    { value: "right_wall", label: "Right wall" },
    { value: "front_desk", label: "Front desk" },
];

const selectClass =
    "mt-2 w-full rounded-xl border border-[#D4A59A]/40 bg-black/25 p-3 text-[#F3E0DC] transition-colors hover:border-[#D4A59A] focus:outline-none focus:ring-2 focus:ring-[#E8BEAC] disabled:opacity-60";

export default function StallEditor({ initialStallId }: { initialStallId: string }) {
    const [selectedId, setSelectedId] = useState(initialStallId);
    const [slot, setSlot] = useState<StallMediaSlot>("back_screen");
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const mediaByStall = useStallMediaStore((state) => state.mediaByStall);
    const removeImage = useStallMediaStore((state) => state.removeImage);
    const stall = getSmallStall(selectedId) ?? smallStalls[0];
    const media = mediaByStall[stall.id];
    const currentImage = media?.[slot];
    const acceptsVideo = slot === "back_screen";

    async function upload(file: File) {
        setError("");
        setUploading(true);
        try { await uploadStallMedia(stall.id, slot, file); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open media."); }
        finally { setUploading(false); }
    }

    return (
        <main className="grid h-dvh grid-cols-1 grid-rows-[1fr_1fr] overflow-hidden bg-[#5C2018] text-[#F3E0DC] md:grid-cols-2 md:grid-rows-1">
            <section className="overflow-y-auto border-b-4 border-[#BC4639] p-5 md:border-b-0 md:border-r-4 md:p-10 lg:p-14" aria-label="Stall media editor">
                <div className="mx-auto max-w-lg">
                    <Link href="/expo" className="text-sm text-[#D4A59A] underline-offset-4 hover:text-[#F3E0DC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BEAC]">
                        Back to exhibition hall
                    </Link>
                    <p className="mt-8 text-sm font-medium text-[#D4A59A]">Exhibitor studio</p>
                    <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#F3E0DC]">Make your stall yours.</h1>
                    <p className="mt-3 text-sm leading-6 text-[#D4A59A]">Your selected stall updates as you edit.</p>

                    <form className="mt-8 space-y-6" onSubmit={(event) => event.preventDefault()}>
                        <label className="block text-sm font-medium">Stall
                            <select className={selectClass} value={stall.id} disabled={uploading} onChange={(event) => {
                                const id = event.target.value;
                                setSelectedId(id); setError("");
                                window.history.replaceState(null, "", `/expo/stall-editor?stall=${encodeURIComponent(id)}`);
                            }}>
                                {smallStalls.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
                            </select>
                        </label>

                        <label className="block text-sm font-medium">Display location
                            <select className={selectClass} value={slot} disabled={uploading} onChange={(event) => { setSlot(event.target.value as StallMediaSlot); setError(""); }}>
                                {slots.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                            </select>
                        </label>

                        <div className="rounded-2xl border-2 border-dashed border-[#D4A59A]/50 bg-black/20 p-5">
                            <label className="block text-sm font-medium" htmlFor="stall-image">{acceptsVideo ? (currentImage ? "Replace image or video" : "Choose image or video") : (currentImage ? "Replace image" : "Choose image")}</label>
                            <p className="mt-1 text-xs text-[#D4A59A]" id="image-help">{acceptsVideo ? "JPG, PNG, WebP, MP4 or WebM / Up to 10 MB / Videos play muted on a loop" : "JPG, PNG or WebP / Up to 1 MB / Fitted without stretching"}</p>
                            <input id="stall-image" type="file" accept={acceptsVideo ? "image/jpeg,image/png,image/webp,video/mp4,video/webm" : "image/jpeg,image/png,image/webp"} disabled={uploading}
                                aria-describedby="image-help"
                                className="mt-4 block w-full text-sm text-[#D4A59A] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#E8BEAC] file:px-4 file:py-2 file:font-semibold file:text-[#5C2018] hover:file:bg-[#F2D2C2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BEAC]"
                                onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
                            {currentImage && (
                                <button type="button"
                                    className="mt-4 rounded-md border border-[#BC4639] bg-[#BC4639]/20 px-3 py-1.5 text-sm font-medium text-[#F3E0DC] hover:bg-[#BC4639] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BEAC] disabled:opacity-60"
                                    disabled={uploading}
                                    onClick={() => { removeImage(stall.id, slot); setError(""); }}>
                                    {currentImage.type === "video" ? "Remove video" : "Remove image"}
                                </button>
                            )}
                        </div>

                        {error && (
                            <p role="alert" className="rounded-lg border-l-4 border-[#BC4639] bg-[#BC4639]/25 px-3 py-2 text-sm text-[#F3E0DC]">{error}</p>
                        )}

                        <p role="status" className="text-sm text-[#F3E0DC]">
                            {uploading
                                ? "Opening media..."
                                : currentImage
                                    ? `${currentImage.type === "video" ? "Video playing" : "Image displayed"} on ${stall.id} / ${slots.find((item) => item.value === slot)?.label}`
                                    : acceptsVideo ? "Choose an image or video to preview on the back screen." : "Choose an image to preview it on this display."}
                        </p>

                        <div className="border-t border-[#D4A59A]/30 pt-5">
                            <p className="mb-3 text-xs text-[#D4A59A]">{slots.filter((item) => media?.[item.value]).length} of 4 display areas customized</p>
                            {uploading
                                ? <span className="block rounded-xl bg-black/30 p-3 text-center text-sm text-[#D4A59A]">Preparing preview...</span>
                                : <Link href={`/expo?stall=${encodeURIComponent(stall.id)}`}
                                    className="block rounded-xl bg-[#E8BEAC] p-3 text-center text-sm font-semibold text-[#5C2018] shadow-lg shadow-black/20 transition-colors hover:bg-[#F2D2C2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F3E0DC]">
                                    View {stall.id} in exhibition hall
                                </Link>}
                        </div>
                    </form>
                </div>
            </section>

            <section className="relative min-h-0 min-w-0 bg-[#F3E0DC]" aria-label="Selected stall preview">
                <div className="pointer-events-none absolute left-5 top-5 z-10 rounded-xl border-l-4 border-[#BC4639] bg-[#5C2018] px-4 py-3 text-[#F3E0DC] shadow-lg shadow-[#5C2018]/30">
                    <p className="text-xs text-[#D4A59A]">Live preview</p>
                    <h2 className="mt-1 text-lg font-semibold">Stall {stall.id}</h2>
                </div>
                <StallPreview stall={stall} media={media} slot={slot} />
            </section>
        </main>
    );
}