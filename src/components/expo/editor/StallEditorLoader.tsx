"use client";
import dynamic from "next/dynamic";
const StallEditor = dynamic(() => import("./StallEditor"), {
    ssr: false,
    loading: () => <main className="flex h-dvh items-center justify-center bg-slate-950 text-slate-300">Loading stall editor...</main>,
});
export default function StallEditorLoader({ initialStallId }: { initialStallId: string }) {
    return <StallEditor initialStallId={initialStallId} />;
}
