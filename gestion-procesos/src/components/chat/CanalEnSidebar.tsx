import { NavLink } from 'react-router-dom'
import type { Channel } from '../../models'

export default function CanalEnSidebar({ channel }: { channel: Channel }) {
  return (
    <li>
      <NavLink to={`/app/chat/${channel.id}`} className="chat__channel">
        # {channel.name}
      </NavLink>
    </li>
  )
}
