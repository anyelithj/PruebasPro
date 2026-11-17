import styles from '../../styles/Spinner.module.scss'

export default function Spinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.ring} aria-hidden="true" />
      <span className="visually-hidden">{label}…</span>
    </div>
  )
}
