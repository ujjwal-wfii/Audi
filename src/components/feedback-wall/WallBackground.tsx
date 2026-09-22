interface WallBackgroundProps {
	wallImage: string;
	children: React.ReactNode;
}

/**
 * The wall image is rendered as a plain block-level <img> (width: 100%,
 * height: auto) so its rendered box defines the coordinate system. The
 * `children` (the notes layer) sit in an absolutely-positioned sibling
 * that exactly matches the image's box, because the wrapping container's
 * height is driven entirely by the image itself. This means normalized
 * 0..1 note coordinates line up with the wall at every breakpoint with
 * no JS measurement or ResizeObserver required.
 */
export function WallBackground({ wallImage, children }: WallBackgroundProps) {
	return (
		<div className="relative w-full select-none">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={wallImage}
				alt="Feedback wall"
				className="block h-auto w-full"
				draggable={false}
			/>
			<div className="absolute inset-0">{children}</div>
		</div>
	);
}
