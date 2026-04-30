import styles from './LoadingSpinner.module.css';

export function LoadingSpinner(): JSX.Element {
  return (
    <div
      className={styles.spinner}
      role="status"
      aria-label="Cargando..."
    />
  );
}
