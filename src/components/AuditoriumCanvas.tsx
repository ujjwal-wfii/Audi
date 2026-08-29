'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AuditoriumScene } from './scene/AuditoriumScene';
import { AuditoriumHUD } from './ui/AuditoriumHUD';
import { SceneState, PovPosition } from '@/types/auditorium';
import { generateSeatingLayout } from '@/utils/seatLayout';

export const AuditoriumCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<AuditoriumScene | null>(null);

  // Application State
  const [sceneState, setSceneState] = useState<SceneState>('LOBBY');
  const [currentPov, setCurrentPov] = useState<PovPosition>('CENTER');
  const [isGateHovered, setIsGateHovered] = useState(false);

  // Initialize Scene on Mount
  useEffect(() => {
    if (!containerRef.current) return;

    const initialSeats = generateSeatingLayout();

    const scene = new AuditoriumScene(containerRef.current, initialSeats, {
      onGateHover: (hovering) => {
        setIsGateHovered(hovering);
      },
      onStateChange: (state) => {
        setSceneState(state);
      },
      onPovChange: (pov) => {
        setCurrentPov(pov);
      },
    });

    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  // Actions
  const handleEnterAuditorium = () => {
    if (sceneRef.current) {
      sceneRef.current.enterAuditorium('CENTER');
    }
  };

  const handlePovChange = (pov: PovPosition) => {
    setCurrentPov(pov);
    if (sceneRef.current) {
      sceneRef.current.switchPov(pov);
    }
  };

  const handleLightingChange = (mode: 'PRESENTATION' | 'HOUSE' | 'CYBER') => {
    if (sceneRef.current) {
      sceneRef.current.setLightingMode(mode);
    }
  };

  const handleViewModeChange = (mode: 'POV' | 'OVERVIEW' | 'LOBBY') => {
    if (sceneRef.current) {
      sceneRef.current.setViewMode(mode);
    }
  };

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-black select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Modern Glassmorphic HUD with 3 POV Switcher */}
      <AuditoriumHUD
        sceneState={sceneState}
        currentPov={currentPov}
        isGateHovered={isGateHovered}
        onEnterClick={handleEnterAuditorium}
        onPovChange={handlePovChange}
        onLightingChange={handleLightingChange}
        onViewModeChange={handleViewModeChange}
      />
    </div>
  );
};
