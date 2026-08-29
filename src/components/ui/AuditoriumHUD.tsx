'use client';

import React from 'react';
import { SceneState, PovPosition } from '@/types/auditorium';
import {
  DoorOpen,
  Sun,
  Layers,
  LogOut,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Star,
} from 'lucide-react';

interface AuditoriumHUDProps {
  sceneState: SceneState;
  currentPov: PovPosition;
  isGateHovered: boolean;
  onEnterClick: () => void;
  onPovChange: (pov: PovPosition) => void;
  onLightingChange: (mode: 'PRESENTATION' | 'HOUSE' | 'CYBER') => void;
  onViewModeChange: (mode: 'POV' | 'OVERVIEW' | 'LOBBY') => void;
}

export const AuditoriumHUD: React.FC<AuditoriumHUDProps> = ({
  sceneState,
  currentPov,
  isGateHovered,
  onEnterClick,
  onPovChange,
  onLightingChange,
  onViewModeChange,
}) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-2 sm:p-3 md:p-6 select-none">
      {/* -------------------------------------------------------------
          TOP BAR (VISIBLE IN SEATED, OVERVIEW & POV MODES)
      ------------------------------------------------------------- */}
      {(sceneState === 'SEATED' || sceneState === 'OVERVIEW' || sceneState === 'CHANGING_SEAT') && (
        <header className="pointer-events-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-2xl px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          {/* Title & Live Badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold text-white tracking-wide">
                  OPEXN
                </h1>

              </div>
              <p className="text-xs text-slate-400">Hall A</p>
            </div>
          </div>

          {/* Quick HUD Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 3 Best Seat POVs Switcher */}
            {/* <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-700/70 shadow-inner">
              <button
                onClick={() => {
                  onViewModeChange('POV');
                  onPovChange('LEFT');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${sceneState === 'SEATED' && currentPov === 'LEFT'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 scale-105'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Left POV
              </button>

              <button
                onClick={() => {
                  onViewModeChange('POV');
                  onPovChange('CENTER');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${sceneState === 'SEATED' && currentPov === 'CENTER'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 scale-105'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                Center POV
              </button>

              <button
                onClick={() => {
                  onViewModeChange('POV');
                  onPovChange('RIGHT');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${sceneState === 'SEATED' && currentPov === 'RIGHT'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 scale-105'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Right POV
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div> */}

            {/* Hall Overview Button */}
            <button
              onClick={() => onViewModeChange('OVERVIEW')}
              className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-all ${sceneState === 'OVERVIEW'
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                : 'bg-slate-800/80 border-slate-700/70 text-slate-300 hover:bg-slate-700/80'
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Hall Overview
            </button>

            {/* Lighting Mode Selector */}
            <div className="hidden md:flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/70">
              <button
                onClick={() => onLightingChange('PRESENTATION')}
                title="Presentation Lighting"
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700/80 transition-all flex items-center gap-1"
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Show
              </button>
              <button
                onClick={() => onLightingChange('HOUSE')}
                title="House Lights On"
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700/80 transition-all flex items-center gap-1"
              >
                House
              </button>
              {/* <button
                onClick={() => onLightingChange('CYBER')}
                title="Cyber Glow"
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700/80 transition-all flex items-center gap-1"
              >
                Cyber
              </button> */}
            </div>

            {/* Exit to Lobby */}
            <button
              onClick={() => onViewModeChange('LOBBY')}
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 border border-slate-700/70 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Exit to Lobby
            </button>
          </div>
        </header>
      )}

      {/* -------------------------------------------------------------
          LOBBY / ENTRANCE GATE CTA OVERLAY
      ------------------------------------------------------------- */}
      {/* {sceneState === 'LOBBY' && (
        <div className="pointer-events-auto my-auto mx-auto max-w-lg w-full bg-slate-950/80 backdrop-blur-xl border border-slate-700/70 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95 duration-500">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-4 text-sky-400 shadow-lg shadow-sky-500/10">
            <DoorOpen className="w-7 h-7" />
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30 mb-2">
            MAIN ENTRANCE • HALL A
          </span>

          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Auditorium
          </h2>
          <p className="text-sm text-slate-400 mt-2 mb-6 max-w-sm">
            Click the double glass gate or press the button below to walk through the doors and take your seat.
          </p>

          <button
            onClick={onEnterClick}
            className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-xl transition-all ${isGateHovered
              ? 'bg-gradient-to-r from-sky-400 to-indigo-500 shadow-sky-500/40 scale-105'
              : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-sky-500/25 hover:scale-[1.02]'
              }`}
          >
            <DoorOpen className="w-5 h-5" />
            Click Gate to Enter Auditorium
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )} */}

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

      {/* -------------------------------------------------------------
          BOTTOM CONTROLS: CLEAN CENTERED 3 POV SEAT SELECTOR
      ------------------------------------------------------------- */}
      {(sceneState === 'SEATED' || sceneState === 'OVERVIEW' || sceneState === 'CHANGING_SEAT') && (
        <div className="pointer-events-auto flex items-center justify-center w-full px-1 sm:px-2 animate-in slide-in-from-bottom-4 duration-300">
          {/* Direct POV Switcher */}
          <div className="flex items-center gap-1 sm:gap-2 max-w-full bg-slate-900/85 backdrop-blur-md p-1 rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
            <button
              onClick={() => onPovChange('LEFT')}
              className={`px-2 sm:px-4 py-2.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all ${currentPov === 'LEFT'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30 scale-105'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Left Seat
            </button>

            <button
              onClick={() => onPovChange('CENTER')}
              className={`px-2 sm:px-5 py-2.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all ${currentPov === 'CENTER'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30 scale-105'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                }`}
            >
              <Star className="w-3.5 h-3.5 fill-current text-amber-300" />
              Center
            </button>

            <button
              onClick={() => onPovChange('RIGHT')}
              className={`px-2 sm:px-4 py-2.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all ${currentPov === 'RIGHT'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30 scale-105'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                }`}
            >
              Right Seat
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
