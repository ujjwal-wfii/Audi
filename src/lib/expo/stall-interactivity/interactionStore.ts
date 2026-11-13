import { useSyncExternalStore } from "react";

/**
 * Tiny store shared by the 3D scene (writes) and the DOM overlay (reads).
 * No dependency needed; swap for zustand later if you already use it.
 */
export type ActiveStall = { id: string; type: string };
type State = { activeStall: ActiveStall | null; panelOpen: boolean };

let state: State = { activeStall: null, panelOpen: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const interactionStore = {
	getState: () => state,
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	/** Called by the proximity tracker. Ignored while the panel is open. */
	setActiveStall(stall: ActiveStall | null) {
		if (state.panelOpen) return;
		if (state.activeStall?.id === stall?.id) return;
		state = { ...state, activeStall: stall };
		emit();
	},
	openPanel() {
		if (!state.activeStall || state.panelOpen) return;
		state = { ...state, panelOpen: true };
		emit();
	},
	closePanel() {
		if (!state.panelOpen) return;
		state = { ...state, panelOpen: false };
		emit();
	},
};

// Use primitive selectors (e.g. s => s.panelOpen) to avoid needless re-renders.
export function useInteractionStore<T>(selector: (s: State) => T): T {
	return useSyncExternalStore(
		interactionStore.subscribe,
		() => selector(state),
		() => selector(state),
	);
}
