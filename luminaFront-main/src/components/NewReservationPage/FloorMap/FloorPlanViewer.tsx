import { useState, useCallback, useMemo } from 'react'
import type { SpaceWithLayout, LayoutDirection } from '../../../types/floor'
import type { SpaceOccupancy } from '../../../types/reservation'
import styles from './FloorPlanViewer.module.css'

export type SpaceStatus = 'available' | 'unavailable' | 'selected' | 'neutral'

interface FloorPlanViewerProps {
  imageUrl: string
  spaces: SpaceWithLayout[]
  availableIds: Set<number>
  selectedId: number | null
  hasSearched: boolean
  occupancyBySpace: Map<number, SpaceOccupancy['intervals']>
  onClickSpace: (spaceId: number) => void
  onClickUnavailableSpace: (spaceId: number) => void
}

type OccupancyInterval = SpaceOccupancy['intervals'][number]

// Desk fills — solid colors
const DESK_FILL: Record<SpaceStatus, string> = {
  available:   '#00c9a7',
  unavailable: '#c0c0c0',
  selected:    '#a100ff',
  neutral:     '#b8c4cc',
}
const DESK_STROKE: Record<SpaceStatus, string> = {
  available:   '#009b80',
  unavailable: '#a0a0a0',
  selected:    '#7500c0',
  neutral:     '#8a9baa',
}

// Area fills — semi-transparent so floor plan shows through
const AREA_FILL: Record<SpaceStatus, string> = {
  available:   'rgba(0, 201, 167, 0.22)',
  unavailable: 'rgba(192, 192, 192, 0.18)',
  selected:    'rgba(161, 0, 255, 0.28)',
  neutral:     'rgba(184, 196, 204, 0.15)',
}
const AREA_STROKE: Record<SpaceStatus, string> = {
  available:   '#00c9a7',
  unavailable: '#b0b0b0',
  selected:    '#a100ff',
  neutral:     '#8a9baa',
}
const AREA_STROKE_WIDTH: Record<SpaceStatus, number> = {
  available:   0.45,
  unavailable: 0.25,
  selected:    0.7,
  neutral:     0.25,
}
const HOVER_STROKE: Record<SpaceStatus, string> = {
  available: '#00a98e',
  unavailable: '#5c6470',
  selected: '#7500c0',
  neutral: '#5f6f7a',
}
const HOVER_LABEL_FILL: Record<SpaceStatus, string> = {
  available: '#0b6f60',
  unavailable: '#323741',
  selected: '#460073',
  neutral: '#3f4d56',
}

function getStatus(
  space: SpaceWithLayout,
  availableIds: Set<number>,
  selectedId: number | null,
  hasSearched: boolean
): SpaceStatus {
  if (space.id === selectedId) return 'selected'
  if (!hasSearched) return 'neutral'
  return availableIds.has(space.id) ? 'available' : 'unavailable'
}

function seatOffset(dir: LayoutDirection, dw: number, dh: number): { dx: number; dy: number } {
  const r = Math.min(dw, dh) * 0.38
  switch (dir) {
    case 'up':    return { dx: 0,  dy: -(dh / 2 + r) }
    case 'down':  return { dx: 0,  dy:  (dh / 2 + r) }
    case 'left':  return { dx: -(dw / 2 + r), dy: 0  }
    case 'right': return { dx:  (dw / 2 + r), dy: 0  }
  }
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function getSpaceAnchor(space: SpaceWithLayout, vbW: number): { x: number; y: number } | null {
  if (space.layout_cx != null && space.layout_cy != null) {
    return { x: space.layout_cx * vbW, y: space.layout_cy * 100 }
  }

  if (!space.layout_points || space.layout_points.length === 0) return null

  if (space.layout_type === 'desk' && space.layout_points.length >= 2) {
    const p0 = space.layout_points[0]
    const p1 = space.layout_points[1]
    return {
      x: ((p0.x + p1.x) / 2) * vbW,
      y: ((p0.y + p1.y) / 2) * 100,
    }
  }

  const sum = space.layout_points.reduce((acc, point) => ({
    x: acc.x + point.x * vbW,
    y: acc.y + point.y * 100,
  }), { x: 0, y: 0 })

  return {
    x: sum.x / space.layout_points.length,
    y: sum.y / space.layout_points.length,
  }
}

interface ShapeProps {
  space: SpaceWithLayout
  vbW: number
  status: SpaceStatus
  hovered: boolean
  onClick: () => void
  titleText: string
  hoverLabel: string
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function OccupantMarker({
  space,
  vbW,
  intervals,
}: {
  space: SpaceWithLayout
  vbW: number
  intervals: OccupancyInterval[]
}) {
  const anchor = getSpaceAnchor(space, vbW)
  if (!anchor || intervals.length === 0) return null

  const primary = intervals[0]
  const user = primary.user
  const clipId = `occupant-avatar-${space.id}-${user.id}`
  const label = `${user.first_name} ${user.last_name} reservó ${space.space_number} de ${primary.start_time} a ${primary.end_time}`
  const radius = 2.75
  const x = anchor.x + 3.2
  const y = Math.max(4, anchor.y - 4.1)

  return (
    <g style={{ pointerEvents: 'none' }}>
      <title>{label}</title>
      <circle
        cx={x.toFixed(3)}
        cy={y.toFixed(3)}
        r={(radius + 0.55).toFixed(3)}
        fill="#ffffff"
        stroke="#7500c0"
        strokeWidth="0.32"
        filter="url(#occupantAvatarLift)"
      />
      <clipPath id={clipId}>
        <circle cx={x.toFixed(3)} cy={y.toFixed(3)} r={radius.toFixed(3)} />
      </clipPath>
      {user.profile_photo_url ? (
        <image
          href={user.profile_photo_url}
          x={(x - radius).toFixed(3)}
          y={(y - radius).toFixed(3)}
          width={(radius * 2).toFixed(3)}
          height={(radius * 2).toFixed(3)}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      ) : (
        <>
          <circle cx={x.toFixed(3)} cy={y.toFixed(3)} r={radius.toFixed(3)} fill="#460073" />
          <text
            x={x.toFixed(3)}
            y={(y + 0.08).toFixed(3)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="1.65"
            fontWeight="bold"
            fill="#ffffff"
          >
            {getInitials(user.first_name, user.last_name)}
          </text>
        </>
      )}
      {intervals.length > 1 && (
        <g>
          <circle
            cx={(x + 3.8).toFixed(3)}
            cy={(y + 1.8).toFixed(3)}
            r="1.8"
            fill="#18151f"
            stroke="#ffffff"
            strokeWidth="0.28"
          />
          <text
            x={(x + 3.8).toFixed(3)}
            y={(y + 1.88).toFixed(3)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="1.25"
            fontWeight="bold"
            fill="#ffffff"
          >
            +{intervals.length - 1}
          </text>
        </g>
      )}
    </g>
  )
}

function AreaShape({ space, vbW, status, hovered, onClick, titleText, hoverLabel, onMouseEnter, onMouseLeave }: ShapeProps) {
  if (!space.layout_points || space.layout_points.length < 2) return null

  const pts = space.layout_points
    .map((p) => `${(p.x * vbW).toFixed(3)},${(p.y * 100).toFixed(3)}`)
    .join(' ')

  const clickable = status !== 'neutral'
  const isSelected = status === 'selected'

  const baseFill   = AREA_FILL[status]
  const baseStroke = AREA_STROKE[status]
  const strokeW    = AREA_STROKE_WIDTH[status]
  const cx = space.layout_cx != null ? space.layout_cx * vbW : null
  const cy = space.layout_cy != null ? space.layout_cy * 100 : null
  const label = isSelected ? space.space_number : hoverLabel
  const labelWidth = Math.max(14, label.length * 1.15)

  // Hover: slightly brighter fill
  const fill   = hovered && clickable ? baseFill.replace(/[\d.]+\)$/, (m) => {
    const v = parseFloat(m) + 0.12
    return Math.min(v, 0.55).toFixed(2) + ')'
  }) : baseFill

  return (
    <g
      onClick={clickable ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      role={clickable ? 'button' : undefined}
      aria-label={space.space_number}
    >
      <title>{titleText}</title>
      <polygon
        points={pts}
        fill={fill}
        stroke={hovered ? HOVER_STROKE[status] : baseStroke}
        strokeWidth={hovered && clickable ? strokeW + 0.48 : strokeW}
        strokeDasharray={isSelected ? '2 0.8' : undefined}
        strokeLinejoin="round"
        filter={hovered || isSelected ? 'url(#spaceLift)' : undefined}
        style={{ transition: 'fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease' }}
      />
      {/* Label in center for areas */}
      {(isSelected || hovered) && cx !== null && cy !== null && (
        <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <rect
            x={(cx - labelWidth / 2).toFixed(3)}
            y={(cy - 3.2).toFixed(3)}
            width={labelWidth.toFixed(3)}
            height="5.8"
            rx="2"
            fill="rgba(255, 255, 255, 0.94)"
            stroke="rgba(24, 21, 31, 0.12)"
            strokeWidth="0.12"
          />
          <text
            x={cx.toFixed(3)}
            y={cy.toFixed(3)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={2}
            fontWeight="bold"
            fill={HOVER_LABEL_FILL[status]}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  )
}

function DeskShape({
  space,
  vbW,
  status,
  hovered,
  onClick,
  titleText,
  hoverLabel,
  onMouseEnter,
  onMouseLeave,
}: ShapeProps) {
  if (!space.layout_points || space.layout_points.length < 2) return null

  const p0 = space.layout_points[0]
  const p1 = space.layout_points[1]
  const x1 = p0.x * vbW, y1 = p0.y * 100
  const x2 = p1.x * vbW, y2 = p1.y * 100
  const dw = x2 - x1, dh = y2 - y1
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const dir = space.layout_direction ?? 'up'
  const seatR = Math.min(dw, dh) * 0.38
  const off = seatOffset(dir, dw, dh)
  const fill   = DESK_FILL[status]
  const stroke = DESK_STROKE[status]
  const clickable = status !== 'neutral'
  const isSelected = status === 'selected'
  const label = isSelected ? space.space_number : hoverLabel
  const labelWidth = Math.max(11, label.length * 1.05)
  const labelY = Math.max(4, my - dh / 2 - seatR - 3.8)

  return (
    <g
      onClick={clickable ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      role={clickable ? 'button' : undefined}
      aria-label={space.space_number}
    >
      <title>{titleText}</title>
      {(hovered || isSelected) && (
        <>
          <rect
            x={(x1 - 0.45).toFixed(3)} y={(y1 - 0.45).toFixed(3)}
            width={(dw + 0.9).toFixed(3)} height={(dh + 0.9).toFixed(3)}
            rx={(Math.min(dw, dh) * 0.22).toFixed(3)}
            fill="none"
            stroke={HOVER_STROKE[status]}
            strokeWidth={0.55}
            opacity={0.78}
            filter="url(#spaceLift)"
          />
          <circle
            cx={(mx + off.dx).toFixed(3)}
            cy={(my + off.dy).toFixed(3)}
            r={(seatR + 0.42).toFixed(3)}
            fill="none"
            stroke={HOVER_STROKE[status]}
            strokeWidth={0.55}
            opacity={0.78}
            filter="url(#spaceLift)"
          />
        </>
      )}
      <rect
        x={x1.toFixed(3)} y={y1.toFixed(3)}
        width={dw.toFixed(3)} height={dh.toFixed(3)}
        rx={(Math.min(dw, dh) * 0.15).toFixed(3)}
        fill={fill}
        stroke={hovered ? HOVER_STROKE[status] : stroke}
        strokeWidth={hovered || isSelected ? 0.34 : 0.18}
        style={{ transition: 'fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease' }}
      />
      <circle
        cx={(mx + off.dx).toFixed(3)}
        cy={(my + off.dy).toFixed(3)}
        r={seatR.toFixed(3)}
        fill={fill}
        stroke={hovered ? HOVER_STROKE[status] : stroke}
        strokeWidth={hovered || isSelected ? 0.34 : 0.18}
        style={{ transition: 'fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease' }}
      />
      {(hovered || isSelected) && (
        <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <rect
            x={(mx - labelWidth / 2).toFixed(3)}
            y={(labelY - 2.8).toFixed(3)}
            width={labelWidth.toFixed(3)}
            height="5.2"
            rx="1.8"
            fill="rgba(255, 255, 255, 0.96)"
            stroke="rgba(24, 21, 31, 0.12)"
            strokeWidth="0.12"
            filter="url(#spaceLift)"
          />
          <text
            x={mx.toFixed(3)}
            y={(labelY - 0.1).toFixed(3)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={1.85}
            fontWeight="bold"
            fill={HOVER_LABEL_FILL[status]}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  )
}

export function FloorPlanViewer({
  imageUrl,
  spaces,
  availableIds,
  selectedId,
  hasSearched,
  occupancyBySpace,
  onClickSpace,
  onClickUnavailableSpace,
}: FloorPlanViewerProps) {
  const [vbW, setVbW] = useState(177.78)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth && img.naturalHeight) {
      setVbW((img.naturalWidth / img.naturalHeight) * 100)
    }
  }, [])

  const { areas, desks, visuals } = useMemo(() => ({
    areas: spaces.filter((s) => !s.visual_only && s.layout_type !== 'desk'),
    desks: spaces.filter((s) => !s.visual_only && s.layout_type === 'desk'),
    visuals: spaces.filter((s) => s.visual_only),
  }), [spaces])

  function getTitle(space: SpaceWithLayout, status: SpaceStatus): string {
    const intervals = occupancyBySpace.get(space.id) ?? []
    if (status !== 'unavailable' || intervals.length === 0) {
      return space.space_number
    }

    return `${space.space_number} ocupado: ${intervals.map((interval) => `${interval.start_time}-${interval.end_time}`).join(', ')}`
  }

  function getHoverLabel(space: SpaceWithLayout, status: SpaceStatus): string {
    const intervals = occupancyBySpace.get(space.id) ?? []
    if (status === 'available') return `${space.space_number} libre`
    if (status === 'selected') return `${space.space_number} seleccionado`
    if (status === 'unavailable' && intervals.length > 0) {
      return `Ocupado hasta ${intervals[intervals.length - 1].end_time}`
    }
    if (status === 'unavailable') return `${space.space_number} ocupado`
    return space.space_number
  }

  function handleShapeClick(space: SpaceWithLayout, status: SpaceStatus) {
    if (status === 'unavailable') {
      onClickUnavailableSpace(space.id)
      return
    }

    if (status === 'available' || status === 'selected') {
      onClickSpace(space.id)
    }
  }

  return (
    <div className={styles.container}>
      <img
        src={imageUrl}
        alt="Plano del piso"
        className={styles.floorImage}
        onLoad={handleImgLoad}
        draggable={false}
      />
      <svg
        viewBox={`0 0 ${vbW.toFixed(3)} 100`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.overlay}
        aria-label="Mapa interactivo de espacios"
      >
        <defs>
          <filter id="spaceLift" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0.55" stdDeviation="0.65" floodColor="#18151f" floodOpacity="0.28" />
          </filter>
          <filter id="occupantAvatarLift" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.5" stdDeviation="0.52" floodColor="#18151f" floodOpacity="0.32" />
          </filter>
        </defs>

        {/* Visual-only background shapes */}
        {visuals.map((space) => {
          if (!space.layout_points || space.layout_points.length < 2) return null
          const pts = space.layout_points
            .map((p) => `${(p.x * vbW).toFixed(3)},${(p.y * 100).toFixed(3)}`)
            .join(' ')
          return <polygon key={space.id} points={pts} fill="#e4e4de" stroke="#d0d0ca" strokeWidth={0.15} />
        })}

        {/* Areas (polygons) — rendered first, behind desks */}
        {areas.map((space) => {
          const status = getStatus(space, availableIds, selectedId, hasSearched)
          return (
            <AreaShape
              key={space.id}
              space={space}
              vbW={vbW}
              status={status}
              hovered={hoveredId === space.id}
              onClick={() => handleShapeClick(space, status)}
              titleText={getTitle(space, status)}
              hoverLabel={getHoverLabel(space, status)}
              onMouseEnter={() => setHoveredId(space.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
          )
        })}

        {/* Desks — on top of areas */}
        {desks.map((space) => {
          const status = getStatus(space, availableIds, selectedId, hasSearched)
          return (
            <DeskShape
              key={space.id}
              space={space}
              vbW={vbW}
              status={status}
              hovered={hoveredId === space.id}
              onClick={() => handleShapeClick(space, status)}
              titleText={getTitle(space, status)}
              hoverLabel={getHoverLabel(space, status)}
              onMouseEnter={() => setHoveredId(space.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
          )
        })}

        {spaces.map((space) => {
          if (space.visual_only) return null
          const intervals = occupancyBySpace.get(space.id) ?? []
          return (
            <OccupantMarker
              key={`occupant-${space.id}`}
              space={space}
              vbW={vbW}
              intervals={intervals}
            />
          )
        })}
      </svg>
    </div>
  )
}
