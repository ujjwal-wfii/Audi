import { SeatData } from '@/types/auditorium';

export const STAGE_CENTER = { x: 0, y: 1.6, z: 0 };

export interface RowConfig {
  row: string;
  elevation: number;
}

// Progressive amphitheater stadium rake for 100% clear sightlines to stage and screen
export const ROW_CONFIGS: RowConfig[] = [
  { row: 'A', elevation: 0.40 },
  { row: 'B', elevation: 0.90 },
  { row: 'C', elevation: 1.45 },
  { row: 'D', elevation: 2.05 },
  { row: 'E', elevation: 2.70 },
  { row: 'F', elevation: 3.40 },
  { row: 'G', elevation: 4.15 },
];

/**
 * Generates the full auditorium seating array where all seats in each block
 * are packed contiguously together side-by-side along the concentric curve.
 */
export function generateSeatingLayout(): SeatData[] {
  const seats: SeatData[] = [];
  const seatPitch = 1.25;
  const centerAisleHalfWidth = 1.8;
  const rowSpacing = 2.2;
  const firstRowZ = 10.0;
  const seatsPerSide = 10;

  ROW_CONFIGS.forEach((rowConfig, rowIndex) => {
    const { row, elevation } = rowConfig;

    const z = firstRowZ + rowIndex * rowSpacing;



    let seatNumCounter = 1;

    // 1. Left Side Bank (Contiguous seats from left outer to center aisle)
    for (let i = 0; i < seatsPerSide; i++) {
      const seatNum = seatNumCounter++;
      // Angle goes from far left (-maxArcAngle) up to left aisle edge
      const x =
        -(centerAisleHalfWidth + seatPitch / 2) - (seatsPerSide - 1 - i) * seatPitch;
      const y = elevation;

      const dx = STAGE_CENTER.x - x;
      const dz = STAGE_CENTER.z - z;
      const distanceToStage = Math.sqrt(dx * dx + dz * dz);
      const rotY = Math.PI;
      const viewAngle = Math.atan2(dx, -dz) * (180 / Math.PI);
      const distancePenalty = Math.max(0, (distanceToStage - 9) * 0.4);
      const anglePenalty = Math.abs(viewAngle) * 0.25;
      const sightlineQuality = Math.max(85, Math.min(99, Math.round(100 - distancePenalty - anglePenalty)));

      // let status: SeatData['status'] = 'available';
      // if ((row === 'A' && [2, 3, 5].includes(seatNum)) || (row === 'C' && [4, 7, 8].includes(seatNum))) {
      //   status = 'occupied';
      // }

      seats.push({
        id: `${row}-${seatNum}`,
        row,
        number: seatNum,
        position: { x, y, z },
        rotation: { x: 0, y: rotY, z: 0 },
        sightlineQuality,
        distanceToStage: Number(distanceToStage.toFixed(1)),
        viewAngle: Number(viewAngle.toFixed(1)),
      });
    }

    // 2. Right Side Bank (Contiguous seats from right aisle edge to far right)
    for (let i = 0; i < seatsPerSide; i++) {
      const seatNum = seatNumCounter++;
      // Angle goes from right aisle edge outward
      const x = centerAisleHalfWidth + seatPitch / 2 + i * seatPitch;
      const y = elevation;

      const dx = STAGE_CENTER.x - x;
      const dz = STAGE_CENTER.z - z;
      const distanceToStage = Math.sqrt(dx * dx + dz * dz);
      const rotY = Math.PI;

      const viewAngle = Math.atan2(dx, -dz) * (180 / Math.PI);

      const distancePenalty = Math.max(0, (distanceToStage - 9) * 0.4);
      const anglePenalty = Math.abs(viewAngle) * 0.25;
      const sightlineQuality = Math.max(85, Math.min(99, Math.round(100 - distancePenalty - anglePenalty)));


      // Default initial selected seat in Row D center (e.g. seat 3 in right block)
      // if (row === 'D' && i === 2) {
      //   status = 'selected';
      // } else if ((row === 'B' && [1, 4, 6].includes(i)) || (row === 'E' && [3, 5, 9].includes(i))) {
      //   status = 'occupied';
      // }

      seats.push({
        id: `${row}-${seatNum}`,
        row,
        number: seatNum,
        position: { x, y, z },
        rotation: { x: 0, y: rotY, z: 0 },
        sightlineQuality,
        distanceToStage: Number(distanceToStage.toFixed(1)),
        viewAngle: Number(viewAngle.toFixed(1)),
      });
    }
  });

  return seats;
}
