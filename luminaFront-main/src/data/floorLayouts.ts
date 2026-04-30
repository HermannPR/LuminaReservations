import type { FloorLayout, SpaceLayoutItem } from '../types/reservation';

// ─── Planta Baja (PB) ────────────────────────────────────────────────────────

const pbSpaces: SpaceLayoutItem[] = [
  // Escritorios PB001–PB020 (filas 1-4, cols 1-5)
  ...Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    const row = Math.floor(i / 5) + 1;
    const col = (i % 5) + 1;
    return {
      id: `PB${String(n).padStart(3, '0')}`,
      row,
      col,
      type: 'escritorio' as const,
    };
  }),
  // Escritorios PB021–PB040 (filas 5-8, cols 1-5)
  ...Array.from({ length: 20 }, (_, i) => {
    const n = i + 21;
    const row = Math.floor(i / 5) + 5;
    const col = (i % 5) + 1;
    return {
      id: `PB${String(n).padStart(3, '0')}`,
      row,
      col,
      type: 'escritorio' as const,
    };
  }),
  // Phone booths
  { id: 'PBPB-001', row: 3, col: 7, type: 'phone_booth' },
  { id: 'PBPB-002', row: 3, col: 8, type: 'phone_booth' },
  // Sala juntas colaborativo
  { id: 'PBCS-001', row: 6, col: 7, type: 'colaborativo', label: 'Sala Juntas' },
  // Non-bookable
  { id: 'PB-RECEPCION', row: 1, col: 7, type: 'non-bookable', label: 'Recepción' },
  { id: 'PB-SANITARIOS', row: 1, col: 8, type: 'non-bookable', label: 'Sanitarios' },
];

// ─── Mezzanine (MZ) ──────────────────────────────────────────────────────────

const mzSpaces: SpaceLayoutItem[] = [
  // Escritorios MZ001–MZ060 (filas 1-10, cols 1-12, saltando escaleras/sanitarios en fila 1 cols 5-8)
  ...(() => {
    const items: SpaceLayoutItem[] = [];
    const skip = new Set(['1-5', '1-6', '1-7', '1-8']);
    let n = 1;
    for (let row = 1; row <= 10 && n <= 60; row++) {
      for (let col = 1; col <= 12 && n <= 60; col++) {
        if (skip.has(`${row}-${col}`)) continue;
        items.push({
          id: `MZ${String(n).padStart(3, '0')}`,
          row,
          col,
          type: 'escritorio' as const,
        });
        n++;
      }
    }
    return items;
  })(),
  // Sala juntas colaborativo
  { id: 'MZCS-001', row: 5, col: 7, type: 'colaborativo', label: 'Sala Juntas' },
  // Non-bookable
  { id: 'MZ-ESCALERAS-1', row: 1, col: 5, type: 'non-bookable', label: 'Escaleras' },
  { id: 'MZ-ESCALERAS-2', row: 1, col: 6, type: 'non-bookable', label: 'Escaleras' },
  { id: 'MZ-SANITARIOS-1', row: 1, col: 7, type: 'non-bookable', label: 'Sanitarios' },
  { id: 'MZ-SANITARIOS-2', row: 1, col: 8, type: 'non-bookable', label: 'Sanitarios' },
];

// ─── Piso 3 ───────────────────────────────────────────────────────────────────

const p3Spaces: SpaceLayoutItem[] = [
  // Escritorios IC3001–IC3050 (filas 2-10, cols 1-10, saltando non-bookable en fila 1)
  ...(() => {
    const items: SpaceLayoutItem[] = [];
    let n = 1;
    for (let row = 2; row <= 10 && n <= 50; row++) {
      for (let col = 1; col <= 10 && n <= 50; col++) {
        items.push({
          id: `IC3${String(n).padStart(3, '0')}`,
          row,
          col,
          type: 'escritorio' as const,
        });
        n++;
      }
    }
    return items;
  })(),
  // Colaborativo
  { id: 'AC-0031', row: 3, col: 12, type: 'colaborativo', label: 'Sala A' },
  { id: 'B03COL', row: 5, col: 12, type: 'colaborativo', label: 'Sala B' },
  // Work lab
  { id: 'WL-0301', row: 8, col: 11, type: 'work_lab', label: 'Work Lab' },
  // Phone booths
  { id: 'PB-0301', row: 9, col: 11, type: 'phone_booth' },
  { id: 'PB-0302', row: 9, col: 12, type: 'phone_booth' },
  // Garage
  { id: 'GA-0301', row: 10, col: 12, type: 'garage', label: 'Garage' },
  // Non-bookable
  { id: 'P3-BANOS-1', row: 1, col: 4, type: 'non-bookable', label: 'Baños' },
  { id: 'P3-BANOS-2', row: 1, col: 5, type: 'non-bookable', label: 'Baños' },
  { id: 'P3-BANOS-3', row: 1, col: 6, type: 'non-bookable', label: 'Baños' },
  { id: 'P3-ESCALERAS-1', row: 1, col: 7, type: 'non-bookable', label: 'Escaleras' },
  { id: 'P3-ESCALERAS-2', row: 1, col: 8, type: 'non-bookable', label: 'Escaleras' },
  { id: 'P3-GARAGE-AREA', row: 1, col: 12, type: 'non-bookable', label: 'Área Garage' },
];

// ─── Piso 9 ───────────────────────────────────────────────────────────────────

const p9Spaces: SpaceLayoutItem[] = [
  // Escritorios 9001–9040 (filas 2-8, cols 1-8)
  ...(() => {
    const items: SpaceLayoutItem[] = [];
    let n = 1;
    for (let row = 2; row <= 8 && n <= 40; row++) {
      for (let col = 1; col <= 8 && n <= 40; col++) {
        items.push({
          id: `9${String(n).padStart(3, '0')}`,
          row,
          col,
          type: 'escritorio' as const,
        });
        n++;
      }
    }
    return items;
  })(),
  // Colaborativo
  { id: '9CS-001', row: 3, col: 10, type: 'colaborativo', label: 'Sala A' },
  { id: '9CS-002', row: 6, col: 10, type: 'colaborativo', label: 'Sala B' },
  // Work lab
  { id: '9WL-001', row: 8, col: 10, type: 'work_lab', label: 'Work Lab' },
  // Phone booths
  { id: '9PB-001', row: 9, col: 9, type: 'phone_booth' },
  { id: '9PB-002', row: 9, col: 10, type: 'phone_booth' },
  // Non-bookable
  { id: 'P9-COMEDOR-1', row: 1, col: 4, type: 'non-bookable', label: 'Comedor' },
  { id: 'P9-COMEDOR-2', row: 1, col: 5, type: 'non-bookable', label: 'Comedor' },
  { id: 'P9-COMEDOR-3', row: 1, col: 6, type: 'non-bookable', label: 'Comedor' },
  { id: 'P9-COMEDOR-4', row: 1, col: 7, type: 'non-bookable', label: 'Comedor' },
  { id: 'P9-ESCALERAS-1', row: 1, col: 8, type: 'non-bookable', label: 'Escaleras' },
  { id: 'P9-ESCALERAS-2', row: 1, col: 9, type: 'non-bookable', label: 'Escaleras' },
  { id: 'P9-DATACENTER', row: 1, col: 12, type: 'non-bookable', label: 'Data Center' },
];

// ─── Exports ──────────────────────────────────────────────────────────────────

export const floorLayouts: FloorLayout[] = [
  {
    floorId: 0,
    floorName: 'Planta Baja',
    rows: 10,
    cols: 10,
    spaces: pbSpaces,
  },
  {
    floorId: 1,
    floorName: 'Mezzanine',
    rows: 12,
    cols: 14,
    spaces: mzSpaces,
  },
  {
    floorId: 3,
    floorName: 'Piso 3',
    rows: 12,
    cols: 14,
    spaces: p3Spaces,
  },
  {
    floorId: 9,
    floorName: 'Piso 9',
    rows: 12,
    cols: 12,
    spaces: p9Spaces,
  },
];

export function getFloorLayout(floorId: number | string): FloorLayout | undefined {
  return floorLayouts.find((f) => f.floorId === floorId);
}

export function computeSpaceStatuses(
  layout: FloorLayout,
  availableSpaceNumbers: Set<string>
): Map<string, 'available' | 'occupied'> {
  const result = new Map<string, 'available' | 'occupied'>();
  for (const space of layout.spaces) {
    if (space.type === 'non-bookable') continue;
    result.set(space.id, availableSpaceNumbers.has(space.id) ? 'available' : 'occupied');
  }
  return result;
}

export const PRIORITY_CATEGORY_LABELS: Record<string, string> = {
  escritorio: 'Escritorio',
  colaborativo: 'Colaborativo',
  work_lab: 'Work Lab',
  phone_booth: 'Phone Booth',
  garage: 'Garage',
};
