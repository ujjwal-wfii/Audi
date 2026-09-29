// lib/selfie-booth/templates.ts

import type { SelfieTemplateId } from "./types";

export interface SelfieTemplate {
	id: SelfieTemplateId;
	name: string;
	preview: string;
	background: string;
	frame?: string;
	description?: string;
}

export const SELFIE_TEMPLATES: SelfieTemplate[] = [
	{
		id: "classic",
		name: "Classic",
		preview: "/selfie-booth/templates/classic/preview.png",
		background: "/selfie-booth/templates/classic/background.png",
		frame: "/selfie-booth/templates/classic/frame.png",
		description: "classic",
	},
	{
		id: "event",
		name: "Event",
		preview: "/selfie-booth/templates/event/preview.png",
		background: "/selfie-booth/templates/event/background.png",
		frame: "/selfie-booth/templates/event/frame.png",
	},
	{
		id: "celebration",
		name: "Celebration",
		preview: "/selfie-booth/templates/celebration/preview.png",
		background: "/selfie-booth/templates/celebration/background.png",
		frame: "/selfie-booth/templates/celebration/frame.png",
	},
];
