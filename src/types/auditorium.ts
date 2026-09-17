export type SceneState = 'LOBBY' | 'ENTERING' | 'SEATED' | 'CHANGING_SEAT' | 'OVERVIEW';

export type PovPosition = 'LEFT' | 'CENTER' | 'RIGHT';

export interface SeatData {
  id: string;              // e.g., "D-10"
  row: string;             // e.g., "D"
  number: number;          // e.g., 10
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  sightlineQuality: number; // Percentage 80-100%
  distanceToStage: number;  // In meters
  viewAngle: number;        // In degrees relative to center stage
}

export interface AuditoriumConfig {
  rows: {
    name: string;
    seatCount: number;
    elevation: number;
  }[];
}
