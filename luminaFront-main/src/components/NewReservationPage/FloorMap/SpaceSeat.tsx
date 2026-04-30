import type { PriorityCategory, SeatStatus } from '../../../types/reservation';
import { PRIORITY_CATEGORY_LABELS } from '../../../data/floorLayouts';
import styles from './SpaceSeat.module.css';

const STATUS_LABELS: Record<SeatStatus, string> = {
  available: 'Disponible',
  occupied: 'Ocupado',
  unavailable: 'No disponible',
  selected: 'Seleccionado',
};

interface SpaceSeatProps {
  spaceNumber: string;
  priorityCategory: PriorityCategory;
  status: SeatStatus;
  onClick: () => void;
}

export function SpaceSeat({ spaceNumber, priorityCategory, status, onClick }: SpaceSeatProps) {
  const categoryLabel = PRIORITY_CATEGORY_LABELS[priorityCategory] ?? priorityCategory;
  const statusLabel = STATUS_LABELS[status];
  const ariaLabel = `${spaceNumber} - ${categoryLabel} - ${statusLabel}`;
  const title = `${spaceNumber} — ${categoryLabel}`;

  return (
    <button
      className={`${styles.seat} ${styles[status]}`}
      aria-label={ariaLabel}
      aria-selected={status === 'selected'}
      aria-disabled={status === 'occupied' || status === 'unavailable'}
      title={title}
      onClick={status === 'available' || status === 'selected' ? onClick : undefined}
      type="button"
    >
      {spaceNumber}
    </button>
  );
}
