"use client";

import { SELFIE_TEMPLATES } from "@/lib/selfie-booth/templates";
import { SelfieTemplateId } from "@/lib/selfie-booth/types";

interface TemplateSelectorProps {
	selectedTemplate: SelfieTemplateId;
	onSelect: (templateId: SelfieTemplateId) => void;
}

export default function TemplateSelector({
	selectedTemplate,
	onSelect,
}: TemplateSelectorProps) {
	return (
		<div className="w-full">
			<p className="mb-3 text-center text-sm font-medium text-white/70">
				Choose your frame
			</p>

			<div
				className="
					flex
					w-full
					justify-start
					gap-3
					overflow-x-auto
					pb-2
					sm:justify-center
					sm:overflow-visible
				"
			>
				{SELFIE_TEMPLATES.map((template) => {
					const selected = template.id === selectedTemplate;

					return (
						<button
							key={template.id}
							onClick={() => onSelect(template.id)}
							className={`
								flex
								min-w-[110px]
								shrink-0
								flex-col
								items-center
								rounded-2xl
								border
								px-5
								py-3
								transition

								${
									selected
										? "border-white bg-white text-black"
										: "border-white/20 bg-white/10 text-white hover:bg-white/20"
								}
							`}
						>
							<span className="font-semibold">
								{template.name}
							</span>

							{selected && (
								<span className="mt-1 text-xs opacity-60">
									Selected
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
