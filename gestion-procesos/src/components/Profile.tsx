import { useState, type FormEvent } from 'react'
import { Alert, Button, Col, Form, Row } from 'react-bootstrap'
import { useAuth } from '../hooks/useAuth'
import { useAppDispatch } from '../hooks/useRedux'
import { useUserPerfil } from '../hooks/UserPerfil'
import { DEFAULT_SETTINGS, type Lang, type UserSettings } from '../models'
import { saveSettings, updateOwnProfile } from '../redux/actions/actionLogin'
import '../styles/StyleProfile.scss'
import PageHeader from './accesories/PageHeader'
import Seo from './accesories/Seo'

type Feedback = { ok: boolean; text: string } | null

/** Perfil (datos personales) y configuración (idioma del chat, avisos) del usuario actual. */
export default function Profile() {
  const dispatch = useAppDispatch()
  const { profile, resetPassword } = useAuth()
  const { name, email, roleLabel, initials } = useUserPerfil()
  const [displayName, setDisplayName] = useState(name)
  const [position, setPosition] = useState(profile?.position ?? '')
  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS, ...profile?.settings })
  const [profileMsg, setProfileMsg] = useState<Feedback>(null)
  const [settingsMsg, setSettingsMsg] = useState<Feedback>(null)
  const [passwordMsg, setPasswordMsg] = useState<Feedback>(null)

  const submitProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (displayName.trim().length < 2)
      return setProfileMsg({ ok: false, text: 'Escribe un nombre de al menos 2 letras.' })
    try {
      await dispatch(updateOwnProfile({ displayName: displayName.trim(), position: position.trim() }))
      setProfileMsg({ ok: true, text: 'Perfil actualizado.' })
    } catch {
      setProfileMsg({ ok: false, text: 'No se pudo actualizar tu perfil.' })
    }
  }

  const submitSettings = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await dispatch(saveSettings(settings))
      setSettingsMsg({ ok: true, text: 'Configuración guardada.' })
    } catch {
      setSettingsMsg({ ok: false, text: 'No se pudo guardar la configuración.' })
    }
  }

  const changePassword = async () => {
    const error = await resetPassword(email)
    setPasswordMsg(
      error
        ? { ok: false, text: error }
        : { ok: true, text: `Te enviamos un correo a ${email} para cambiar tu contraseña.` },
    )
  }

  return (
    <>
      <Seo title="Mi perfil" noIndex />
      <PageHeader title="Mi perfil y configuración" />
      <div className="profile-card">
        <span className="profile-card__avatar" aria-hidden="true">
          {initials}
        </span>
        <dl className="profile-card__data">
          <dt>Correo</dt>
          <dd>{email}</dd>
          <dt>Rol</dt>
          <dd>{roleLabel}</dd>
        </dl>
      </div>

      <Form onSubmit={submitProfile} className="form-panel mt-4" aria-labelledby="perfil-datos">
        <h2 id="perfil-datos" className="h5">
          Datos personales
        </h2>
        {profileMsg && (
          <Alert variant={profileMsg.ok ? 'success' : 'danger'} role="status">
            {profileMsg.text}
          </Alert>
        )}
        <Row className="g-3">
          <Col md={6}>
            <Form.Label htmlFor="perfil-nombre">Nombre</Form.Label>
            <Form.Control
              id="perfil-nombre"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </Col>
          <Col md={6}>
            <Form.Label htmlFor="perfil-cargo">Cargo</Form.Label>
            <Form.Control
              id="perfil-cargo"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              autoComplete="organization-title"
            />
          </Col>
        </Row>
        <Button type="submit" className="mt-3">
          Guardar datos
        </Button>
      </Form>

      <Form onSubmit={submitSettings} className="form-panel mt-4" aria-labelledby="perfil-config">
        <h2 id="perfil-config" className="h5">
          Configuración
        </h2>
        {settingsMsg && (
          <Alert variant={settingsMsg.ok ? 'success' : 'danger'} role="status">
            {settingsMsg.text}
          </Alert>
        )}
        <Row className="g-3">
          <Col md={6}>
            <Form.Label htmlFor="cfg-lang">Traducir los mensajes del chat a</Form.Label>
            <Form.Select
              id="cfg-lang"
              value={settings.chatLang}
              onChange={(e) => setSettings({ ...settings, chatLang: e.target.value as Lang })}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </Form.Select>
          </Col>
          <Col md={6}>
            <Form.Label htmlFor="cfg-days">Avisar de vencimientos con (días)</Form.Label>
            <Form.Control
              id="cfg-days"
              type="number"
              min={0}
              max={30}
              value={settings.dueSoonDays}
              onChange={(e) =>
                setSettings({ ...settings, dueSoonDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })
              }
            />
          </Col>
          <Col xs={12}>
            <Form.Check
              type="switch"
              id="cfg-assign"
              label="Notificarme cuando me asignen un proceso o tarea"
              checked={settings.notifyAssignments}
              onChange={(e) => setSettings({ ...settings, notifyAssignments: e.target.checked })}
            />
            <Form.Check
              type="switch"
              id="cfg-status"
              label="Notificarme cuando cambie el estado de mis procesos o tareas"
              checked={settings.notifyStatus}
              onChange={(e) => setSettings({ ...settings, notifyStatus: e.target.checked })}
            />
          </Col>
        </Row>
        <Button type="submit" className="mt-3">
          Guardar configuración
        </Button>
      </Form>

      <section className="form-panel mt-4" aria-labelledby="perfil-seguridad">
        <h2 id="perfil-seguridad" className="h5">
          Seguridad
        </h2>
        {passwordMsg && (
          <Alert variant={passwordMsg.ok ? 'success' : 'danger'} role="status">
            {passwordMsg.text}
          </Alert>
        )}
        <p className="text-secondary">Si ingresas con Google, tu contraseña la gestiona Google.</p>
        <Button variant="outline-primary" onClick={changePassword}>
          Enviarme un correo para cambiar la contraseña
        </Button>
      </section>
    </>
  )
}
