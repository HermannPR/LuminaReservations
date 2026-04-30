import { useEffect } from 'react';
import styles from './ErrorBanner.module.css';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps): JSX.Element {
  useEffect(() => {
    if (!onDismiss) return;
    const timeoutId = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [message, onDismiss]);

  return (
    <div role="alert" className={`${styles.banner} ${onDismiss ? styles.bannerDismissable : ''}`}>
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label="Cerrar"
        >
          ×
        </button>
      )}
    </div>
  );
}
