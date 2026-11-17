import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  actions?: ReactNode
  back?: { to: string; label: string }
}

export default function PageHeader({ title, subtitle, actions, back }: Props) {
  return (
    <header className="page-header">
      <div>
        {back && (
          <Link to={back.to} className="small">
            ← {back.label}
          </Link>
        )}
        <h1 className="h3 mb-1">{title}</h1>
        {subtitle && <p className="text-secondary mb-0">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}
