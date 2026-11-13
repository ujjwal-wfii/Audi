import HallCanvasLoader from "@/components/expo/world/HallCanvasLoader";
import { getSmallStall } from "@/components/expo/stalls/stallLayout";
export default async function ExhibitionWorldPage({ searchParams }: {
    searchParams: Promise<{ stall?: string | string[] }>;
}) {
    const { stall } = await searchParams;
    const selected = getSmallStall(typeof stall === "string" ? stall : undefined);
    return <HallCanvasLoader focusStallId={selected?.id} />;
}
