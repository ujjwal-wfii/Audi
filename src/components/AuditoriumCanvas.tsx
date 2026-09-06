'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AuditoriumScene } from './scene/AuditoriumScene';
import { AuditoriumHUD } from './ui/AuditoriumHUD';
import { SceneState, PovPosition } from '@/types/auditorium';
import { generateSeatingLayout } from '@/utils/seatLayout';

export const AuditoriumCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<AuditoriumScene | null>(null);

  // -------------------------------------------------------------
  // APPLICATION STATE
  // -------------------------------------------------------------
  const [sceneState, setSceneState] = useState<SceneState>('LOBBY');
  const [currentPov, setCurrentPov] = useState<PovPosition>('CENTER');
  const [isGateHovered, setIsGateHovered] = useState(false);

  // Mobile orientation
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  // Show rotate-phone message when user tries to enter
  // the auditorium while in portrait mode.
  const [showRotateMessage, setShowRotateMessage] = useState(false);

  // -------------------------------------------------------------
  // MOBILE ORIENTATION DETECTION
  // -------------------------------------------------------------
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 768;
      const isPortrait = window.innerHeight > window.innerWidth;

      const portraitMobile = isMobile && isPortrait;

      setIsPortraitMobile(portraitMobile);

      // Automatically remove the rotate message
      // when the phone is rotated to landscape.
      if (!portraitMobile) {
        setShowRotateMessage(false);
      }
    };

    // Initial check
    checkOrientation();

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // -------------------------------------------------------------
  // INITIALIZE THREE.JS SCENE
  // -------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const initialSeats = generateSeatingLayout();

    const scene = new AuditoriumScene(
      containerRef.current,
      initialSeats,
      {
        onGateHover: (hovering) => {
          setIsGateHovered(hovering);
        },

        onStateChange: (state) => {
          setSceneState(state);
        },

        onPovChange: (pov) => {
          setCurrentPov(pov);
        },
      }
    );

    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------
  // ENTER AUDITORIUM
  // -------------------------------------------------------------
  const handleEnterAuditorium = () => {
    // -----------------------------------------------------------
    // MOBILE PORTRAIT
    // Show rotate message instead of entering.
    // -----------------------------------------------------------
    if (isPortraitMobile) {
      setShowRotateMessage(true);
      return;
    }

    // -----------------------------------------------------------
    // LANDSCAPE / DESKTOP
    // Enter normally.
    // -----------------------------------------------------------
    if (sceneRef.current) {
      sceneRef.current.enterAuditorium('CENTER');
    }
  };

  // -------------------------------------------------------------
  // POV CHANGE
  // -------------------------------------------------------------
  const handlePovChange = (pov: PovPosition) => {
    // Don't allow POV changes while portrait.
    if (isPortraitMobile) {
      setShowRotateMessage(true);
      return;
    }

    setCurrentPov(pov);

    if (sceneRef.current) {
      sceneRef.current.switchPov(pov);
    }
  };

  // -------------------------------------------------------------
  // LIGHTING
  // -------------------------------------------------------------
  const handleLightingChange = (
    mode: 'PRESENTATION' | 'HOUSE' | 'CYBER'
  ) => {
    if (sceneRef.current) {
      sceneRef.current.setLightingMode(mode);
    }
  };

  // -------------------------------------------------------------
  // VIEW MODE
  // -------------------------------------------------------------
  const handleViewModeChange = (
    mode: 'POV' | 'OVERVIEW' | 'LOBBY'
  ) => {
    if (sceneRef.current) {
      sceneRef.current.setViewMode(mode);
    }
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-black select-none">

      {/* =========================================================
          3D WEBGL CANVAS
      ========================================================= */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* =========================================================
          AUDITORIUM HUD
      ========================================================= */}
      <AuditoriumHUD
        sceneState={sceneState}
        currentPov={currentPov}
        isGateHovered={isGateHovered}
        onEnterClick={handleEnterAuditorium}
        onPovChange={handlePovChange}
        onLightingChange={handleLightingChange}
        onViewModeChange={handleViewModeChange}
      />

      {/* =========================================================
          ROTATE PHONE OVERLAY
          
          Shows when:
          
          1. User clicks Enter Auditorium in portrait
          
          OR
          
          2. User is already inside the auditorium and
             rotates the phone back to portrait.
      ========================================================= */}
      {(showRotateMessage ||
        (isPortraitMobile && sceneState !== 'LOBBY')) && (
          <div
            className="
            fixed inset-0
            z-[9999]
            flex items-center justify-center
            bg-slate-950/95
            backdrop-blur-md
          "
          >
            <div
              className="
              flex flex-col
              items-center
              justify-center
              text-center
              px-8
              max-w-sm
            "
            >

              {/* -------------------------------------------------
                PHONE ICON
            ------------------------------------------------- */}
              <div className="relative mb-8">

                {/* <div className="text-7xl animate-pulse">
                  📱
                </div> */}

                {/* Rotation arrow */}
                <div
                  className="
                  absolute -right-10 top-1/2 -translate-y-1/2 text-4xl text-cyan-400 animate-pulse"
                >
                  ↻
                </div>

              </div>

              {/* -------------------------------------------------
                TITLE
            ------------------------------------------------- */}
              <h2
                className="text-2xl sm:text-3xl font-semibold text-white mb-3"
              >
                Rotate Your Phone
              </h2>

              {/* -------------------------------------------------
                DESCRIPTION
            ------------------------------------------------- */}
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                Please rotate your phone to experience the auditorium.
              </p>

              {/* -------------------------------------------------
                LANDSCAPE INDICATOR
            ------------------------------------------------- */}
              {/* <div
                className="mt-7 flex items-center gap-3 text-cyan-400"
              >
                <span className="text-2xl">
                  ↔
                </span>

                <span
                  className="text-sm font-medium tracking-wide"
                >
                  Landscape mode required
                </span>
              </div> */}

              {/* -------------------------------------------------
                STAY IN LOBBY
                Only shown when the user has not entered yet.
            ------------------------------------------------- */}
              {sceneState === 'LOBBY' && showRotateMessage && (
                <button
                  onClick={() => setShowRotateMessage(false)}
                  className="
                  mt-8 px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/70 text-slate-300 text-sm hover:bg-slate-800 hover:text-white transition-all"
                >
                  Stay in Lobby
                </button>
              )}

            </div>
          </div>
        )}
    </div>
  );
};


