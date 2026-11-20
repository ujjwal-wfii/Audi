import StallEditorLoader from "@/components/expo/editor/StallEditorLoader";
import {
	getSmallStall,
	smallStalls,
} from "@/lib/expo/stall-editor/stallLayout";
export default async function StallEditorPage({
	searchParams,
}: {
	searchParams: Promise<{ stall?: string | string[] }>;
}) {
	const { stall } = await searchParams;
	const selected =
		getSmallStall(typeof stall === "string" ? stall : undefined) ??
		smallStalls[0];
	return <StallEditorLoader key={selected.id} initialStallId={selected.id} />;
}
