'use client';

import React from 'react';
import type { SceneState } from '@/types/auditorium';
import { LogOut } from 'lucide-react';

interface AuditoriumHUDProps {
  sceneState: SceneState;
  onExit: () => void;
}

export const AuditoriumHUD: React.FC<AuditoriumHUDProps> = ({ sceneState, onExit }) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none">

      {/* -------------------------------------------------------------
        EXIT TO LOBBY — TOP LEFT CORNER
    ------------------------------------------------------------- */}
      {sceneState === 'SEATED' && (
          <div className="pointer-events-auto absolute top-2 left-2">
            <button
              onClick={onExit}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl
                     bg-slate-900/85 hover:bg-rose-950/70
                     backdrop-blur-md
                     border border-slate-700/70 hover:border-rose-700/60
                     text-slate-300 hover:text-rose-300
                     text-xs sm:text-sm font-medium
                     flex items-center gap-2
                     shadow-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Exit to Lobby</span>
            </button>
          </div>
        )}




      {/* -------------------------------------------------------------
          ENTERING CINEMATIC TRANSITION BANNER
      ------------------------------------------------------------- */}
      {sceneState === 'ENTERING' && (
        <div className="my-auto mx-auto bg-slate-950/85 backdrop-blur-xl border border-sky-500/40 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-4 animate-in fade-in duration-300">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <div>
            <div className="text-sm font-bold text-white">Opening Gates & Taking Your Seat...</div>
            <div className="text-xs text-sky-400">Moving through center aisle</div>
          </div>
        </div>
      )}

    </div>
  );
};
