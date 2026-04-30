import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NewReservationPage } from './NewReservationPage'
import { getSession } from '../../services/tokenStore'
import { createReservation, fetchAvailability, fetchFloorOccupancy, fetchRecommendations } from '../../services/reservationService'
import { fetchFloors, fetchFloorSpaces } from '../../services/floorService'

vi.mock('../../services/tokenStore', () => ({
  getSession: vi.fn(),
  clearSession: vi.fn(),
}))

vi.mock('../../services/reservationService', () => ({
  fetchAvailability: vi.fn(),
  fetchFloorOccupancy: vi.fn(),
  fetchRecommendations: vi.fn(),
  createReservation: vi.fn(),
}))

vi.mock('../../services/floorService', () => ({
  fetchFloors: vi.fn(),
  fetchFloorSpaces: vi.fn(),
}))

const recommendationSpace = {
  id: 21,
  space_number: 'PB-21',
  floor_id: 1,
  priority_category: 'escritorio' as const,
  is_active: true,
}

describe('NewReservationPage integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-04-29T10:00:00-06:00'))

    vi.mocked(getSession).mockReturnValue({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_in: 3600,
      login_timestamp: 1777478400,
      user: {
        id: 7,
        email: 'user@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        employee_id: 'E-7',
        role: 'employee',
        department: 'Engineering',
        profile_photo_url: null,
      },
    })

    vi.mocked(fetchAvailability).mockResolvedValue({ success: true, data: [recommendationSpace] })
    vi.mocked(fetchFloorOccupancy).mockResolvedValue({ success: true, data: [] })
    vi.mocked(fetchRecommendations).mockResolvedValue({
      success: true,
      data: {
        model: {
          name: 'Lumina Workspace AI',
          version: 'local-xai-v1.1',
          confidence: 0.88,
          factors: ['historial personal', 'colaboradores frecuentes', 'ocupación histórica'],
        },
        predicted_occupancy: 0.82,
        prediction_label: 'alta',
        recommendations: [
          {
            space: recommendationSpace,
            score: 96,
            confidence: 0.91,
            ai_summary: 'Recomendado por colaboración cercana y 88% de ajuste al contexto.',
            reasons: ['El modelo detectó afinidad con Ana Garcia y un asiento cercano en el mapa'],
            signals: [
              { label: 'Colaboración', value: 'Ana Garcia, 8 coincidencias históricas', weight: 28, strength: 0.95 },
            ],
            nearby_user: {
              id: 11,
              email: 'ana@example.com',
              first_name: 'Ana',
              last_name: 'Garcia',
              department: 'Delivery',
              profile_photo_url: null,
            },
            predicted_occupancy: 0.82,
          },
        ],
      },
    })
    vi.mocked(fetchFloors).mockResolvedValue({
      success: true,
      data: [{ id: 1, floor_number: 0, name: 'Planta Baja', plan_image_url: '/pb.png', is_active: true }],
    })
    vi.mocked(fetchFloorSpaces).mockResolvedValue({
      success: true,
      data: [{
        ...recommendationSpace,
        layout_type: 'desk',
        layout_direction: 'up',
        layout_cx: 0.18,
        layout_cy: 0.18,
        layout_points: [{ x: 0.16, y: 0.16 }, { x: 0.2, y: 0.2 }],
        visual_only: false,
      }],
    })
    vi.mocked(createReservation).mockResolvedValue({
      success: true,
      data: {
        reservation_id: 44,
        reservation_code: 'DESK1234',
        space_id: 21,
        reservation_date: '2099-06-01',
        start_time: '10:00',
        end_time: '11:00',
        status: 'confirmada',
        requiere_estacionamiento: true,
        parking_spot: { zone_name: 'T1', spot_number: 'T1-01' },
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders AI recommendations and creates a workspace reservation with parking', async () => {
    render(
      <MemoryRouter
        initialEntries={['/nueva-reserva']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <NewReservationPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/fecha/i), {
      target: { value: '2099-06-01' },
    })

    const recommendation = await screen.findByRole('button', { name: /PB-21/i })
    expect(screen.queryByText(/Mapa IA activo/i)).not.toBeInTheDocument()

    fireEvent.click(recommendation)
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar reserva$/i }))

    const checkbox = await screen.findByRole('checkbox', { name: /Solicitar lugar de estacionamiento/i })
    fireEvent.click(checkbox)
    const confirmButtons = screen.getAllByRole('button', { name: /^Confirmar reserva$/i })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => {
      expect(createReservation).toHaveBeenCalledWith(expect.objectContaining({
        space_id: 21,
        reservation_date: '2099-06-01',
        requiere_estacionamiento: true,
      }), 'token-123')
    })
  })
})
