import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSessionValid, clearSession } from '../../services/tokenStore'
import { LoginForm } from '../LoginForm/LoginForm'
import styles from './LoginPage.module.css'
import accGtDimensional from '../../assets/Acc_GT_Dimensional_RGB.png'
import accLogoWhitePurple from '../../assets/Acc_Logo_White_Purple_RGB.png'
import accLogoBlackPurple from '../../assets/Acc_Logo_Black_Purple_RGB.png'

const features = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="12" y1="14" x2="12" y2="18"/>
        <line x1="10" y1="16" x2="14" y2="16"/>
      </svg>
    ),
    label: 'Reservas en segundos',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    label: 'Disponibilidad visual por piso',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    label: 'Check-in desde tu teléfono',
  },
]

export function LoginPage(): JSX.Element {
  const navigate = useNavigate()

  useEffect(() => {
    if (isSessionValid()) {
      navigate('/dashboard', { replace: true })
    } else {
      clearSession()
    }
  }, [navigate])

  return (
    <div className={styles.page}>
      {/* Grain texture */}
      <div className={styles.grain} />
      {/* Page ambient glows */}
      <div className={styles.bgGlowA} />
      <div className={styles.bgGlowB} />
      <div className={styles.bgGlowC} />
      <div className={styles.bgGlowOrange} />
      <div className={styles.bgGlowPurple} />

      <div className={styles.shell}>
        {/* ── LEFT — dark brand panel ── */}
        <section className={styles.left}>
          {/* Inner panel glows */}
          <div className={styles.leftGlowA} />
          <div className={styles.leftGlowB} />
          <div className={styles.leftGlowC} />
          <div className={styles.leftGlowOrange} />

          <div className={styles.brand}>
            <div className={styles.logoBox}>
              <img src={accGtDimensional} alt="" className={styles.logoMark} />
            </div>
            <div>
              <h1 className={styles.logoText}>Lumina</h1>
              <p className={styles.brandSubtitle}>Accenture Workspace</p>
            </div>
          </div>

          <div className={styles.hero}>
            <p className={styles.eyebrow}>Workspace Experience</p>
            <h2 className={styles.heroTitle}>Tu espacio,{'\n'}a un clic</h2>
            <p className={styles.heroText}>
              Reserva escritorios y salas colaborativas en los pisos de Accenture.
            </p>

            <div className={styles.featureList}>
              {features.map((f) => (
                <div key={f.label} className={styles.featureChip}>
                  <span className={styles.featureIcon}>{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.statsStrip}>
            <span className={styles.statItem}>4 pisos</span>
            <span className={styles.statDivider} />
            <span className={styles.statItem}>200+ espacios</span>
            <span className={styles.statDivider} />
            <img src={accLogoWhitePurple} alt="Accenture" className={styles.accentureWordmark} />
          </div>
        </section>

        {/* ── RIGHT — login form ── */}
        <section className={styles.right}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <img src={accLogoBlackPurple} alt="Accenture" className={styles.cardLogo} />
              <p className={styles.cardEyebrow}>Bienvenido de vuelta</p>
              <h2 className={styles.cardTitle}>Iniciar sesión</h2>
              <p className={styles.cardSubtitle}>
                Accede para comenzar a reservar espacios.
              </p>
            </div>

            <LoginForm />
          </div>
        </section>
      </div>
    </div>
  )
}
