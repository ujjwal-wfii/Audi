import { SeatData } from '@/types/auditorium';

export const STAGE_CENTER = { x: 0, y: 1.6, z: 0 };

export interface RowConfig {
  row: string;
  radius: number;
  elevation: number;
  tier: 'VIP' | 'Premium' | 'Standard' | 'Balcony';
  price: number;
}

// Progressive amphitheater stadium rake for 100% clear sightlines to stage and screen
export const ROW_CONFIGS: RowConfig[] = [
  { row: 'A', radius: 9.0, elevation: 0.40, tier: 'VIP', price: 150 },
  { row: 'B', radius: 11.2, elevation: 0.90, tier: 'VIP', price: 130 },
  { row: 'C', radius: 13.4, elevation: 1.45, tier: 'Premium', price: 105 },
  { row: 'D', radius: 15.6, elevation: 2.05, tier: 'Premium', price: 90 },
  { row: 'E', radius: 17.8, elevation: 2.70, tier: 'Standard', price: 70 },
  { row: 'F', radius: 20.0, elevation: 3.40, tier: 'Standard', price: 55 },
  { row: 'G', radius: 22.2, elevation: 4.15, tier: 'Balcony', price: 45 },
];

/**
 * Generates the full auditorium seating array where all seats in each block
 * are packed contiguously together side-by-side along the concentric curve.
 */
export function generateSeatingLayout(): SeatData[] {
  const seats: SeatData[] = [];
  const seatPitch = 0.58; // 58cm per seat width along the arc (tightly continuous)
  const maxArcAngle = 0.62; // ~35.5 degrees left & right
  const centerAisleHalfWidth = 0.9; // 1.8m center aisle walkway

  ROW_CONFIGS.forEach((rowConfig) => {
    const { row, radius, elevation, tier, price } = rowConfig;

    // Angular width of one chair at this radius
    const deltaTheta = seatPitch / radius;
    // Angular clearance for center aisle
    const aisleTheta = centerAisleHalfWidth / radius;
    // Available angular span for one side block
    const availableSpan = maxArcAngle - aisleTheta;
    const seatsPerSide = Math.max(6, Math.floor(availableSpan / deltaTheta));

    let seatNumCounter = 1;

    // 1. Left Side Bank (Contiguous seats from left outer to center aisle)
    for (let i = 0; i < seatsPerSide; i++) {
      const seatNum = seatNumCounter++;
      // Angle goes from far left (-maxArcAngle) up to left aisle edge
      const angle = -(aisleTheta + (seatsPerSide - 1 - i + 0.5) * deltaTheta);

      const x = Math.sin(angle) * radius;
      const z = STAGE_CENTER.z + Math.cos(angle) * radius;
      const y = elevation;

      const dx = STAGE_CENTER.x - x;
      const dz = STAGE_CENTER.z - z;
      const distanceToStage = Math.sqrt(dx * dx + dz * dz);
      const rotY = Math.atan2(dx, dz) + Math.PI;

      const angleDeviationDeg = Math.abs((angle * 180) / Math.PI);
      const distancePenalty = (radius - 9) * 0.4;
      const anglePenalty = angleDeviationDeg * 0.25;
      const sightlineQuality = Math.max(85, Math.min(99, Math.round(100 - distancePenalty - anglePenalty)));

      let status: SeatData['status'] = 'available';
      if ((row === 'A' && [2, 3, 5].includes(seatNum)) || (row === 'C' && [4, 7, 8].includes(seatNum))) {
        status = 'occupied';
      }

      seats.push({
        id: `${row}-${seatNum}`,
        row,
        number: seatNum,
        tier,
        price,
        position: { x, y, z },
        rotation: { x: 0, y: rotY, z: 0 },
        status,
        sightlineQuality,
        distanceToStage: Number(distanceToStage.toFixed(1)),
        viewAngle: Number(((angle * 180) / Math.PI).toFixed(1)),
      });
    }

    // 2. Right Side Bank (Contiguous seats from right aisle edge to far right)
    for (let i = 0; i < seatsPerSide; i++) {
      const seatNum = seatNumCounter++;
      // Angle goes from right aisle edge outward
      const angle = aisleTheta + (i + 0.5) * deltaTheta;

      const x = Math.sin(angle) * radius;
      const z = STAGE_CENTER.z + Math.cos(angle) * radius;
      const y = elevation;

      const dx = STAGE_CENTER.x - x;
      const dz = STAGE_CENTER.z - z;
      const distanceToStage = Math.sqrt(dx * dx + dz * dz);
      const rotY = Math.atan2(dx, dz) + Math.PI;

      const angleDeviationDeg = Math.abs((angle * 180) / Math.PI);
      const distancePenalty = (radius - 9) * 0.4;
      const anglePenalty = angleDeviationDeg * 0.25;
      const sightlineQuality = Math.max(85, Math.min(99, Math.round(100 - distancePenalty - anglePenalty)));

      let status: SeatData['status'] = 'available';
      // Default initial selected seat in Row D center (e.g. seat 3 in right block)
      if (row === 'D' && i === 2) {
        status = 'selected';
      } else if ((row === 'B' && [1, 4, 6].includes(i)) || (row === 'E' && [3, 5, 9].includes(i))) {
        status = 'occupied';
      }

      seats.push({
        id: `${row}-${seatNum}`,
        row,
        number: seatNum,
        tier,
        price,
        position: { x, y, z },
        rotation: { x: 0, y: rotY, z: 0 },
        status,
        sightlineQuality,
        distanceToStage: Number(distanceToStage.toFixed(1)),
        viewAngle: Number(((angle * 180) / Math.PI).toFixed(1)),
      });
    }
  });

  return seats;
}
