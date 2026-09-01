import type { LoginResponse } from '../types/auth';
import type { FloorSummary, SpaceWithLayout } from '../types/floor';
import type { SpaceAvailability, SpaceOccupancy } from '../types/reservation';

/** Offline demo mode: active when no backend URL is configured, so the public
 *  preview shows a usable reservation flow instead of a network error. */
export function isDemoMode(): boolean {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return !url || url.trim() === '';
}

export const DEMO_EMAIL = 'demo@workhub.mx';
export const DEMO_PASSWORD = 'demopass123';

export function demoLogin(): LoginResponse {
  return {
    access_token: 'demo-access-token',
    token_type: 'Bearer',
    expires_in: 86400,
    user: {
      id: 1,
      email: DEMO_EMAIL,
      first_name: 'Hermann',
      last_name: 'Demo',
      employee_id: 'EMP-001',
      role: 'employee',
      department: 'Ingeniería',
      profile_photo_url: null,
    },
  };
}

export function demoFloors(): FloorSummary[] {
  return [
    { id: 1, floor_number: 1, name: 'Piso 1', plan_image_url: null, is_active: true },
    { id: 2, floor_number: 2, name: 'Piso 2', plan_image_url: null, is_active: true },
  ];
}

export function demoAvailability(): SpaceAvailability[] {
  return [
    { id: 101, space_number: '1-001', floor_id: 1, priority_category: 'escritorio', is_active: true },
    { id: 102, space_number: '1-002', floor_id: 1, priority_category: 'escritorio', is_active: true },
    { id: 103, space_number: '1-003', floor_id: 1, priority_category: 'colaborativo', is_active: true },
    { id: 201, space_number: '2-001', floor_id: 2, priority_category: 'work_lab', is_active: true },
    { id: 202, space_number: '2-002', floor_id: 2, priority_category: 'phone_booth', is_active: true },
  ];
}

export function demoOccupancy(floorId: number): SpaceOccupancy[] {
  const user = {
    id: 9,
    first_name: 'Ana',
    last_name: 'López',
    email: 'ana@workhub.mx',
    department: 'Diseño',
    profile_photo_url: null,
  };
  const interval = { start_time: '09:00', end_time: '13:00', status: 'confirmada' as const, user };
  return floorId === 1
    ? [
        { space_id: 101, intervals: [interval] },
        { space_id: 102, intervals: [{ ...interval, status: 'activa' as const }] },
      ]
    : [{ space_id: 201, intervals: [interval] }];
}

export function demoFloorSpaces(floorId: number): SpaceWithLayout[] {
  return [
    { id: 101, space_number: '1-001', floor_id: floorId, priority_category: 'escritorio', is_active: true, layout_type: 'rect', layout_direction: null, layout_cx: 120, layout_cy: 120, layout_points: null, visual_only: false },
    { id: 102, space_number: '1-002', floor_id: floorId, priority_category: 'escritorio', is_active: true, layout_type: 'rect', layout_direction: null, layout_cx: 220, layout_cy: 120, layout_points: null, visual_only: false },
    { id: 103, space_number: '1-003', floor_id: floorId, priority_category: 'colaborativo', is_active: true, layout_type: 'polygon', layout_direction: null, layout_cx: 300, layout_cy: 260, layout_points: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }], visual_only: false },
  ];
}
