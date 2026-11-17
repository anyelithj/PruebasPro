import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useChat } from '../../hooks/useChat'
import '../../styles/StyleChat.scss'
import Seo from '../accesories/Seo'
import { convertirId } from '../helpers/ConvertirId'
import ChatScreen from './ChatScreen'
import Sliderbar from './Sliderbar'

/** Contenedor del chat: lee el canal de la URL y reparte datos a los componentes de presentación. */
export default function CanalRoute() {
  const { canalId } = useParams()
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const { channels, messages, sendMessage, createChannel, currentChannel } = useChat(canalId)

  const handleCreate = async (name: string) => {
    const id = await createChannel(convertirId(name) ? name : 'canal')
    navigate(`/app/chat/${id}`)
  }

  return (
    <div className="chat">
      <Seo title="Chat" noIndex />
      <h1 className="visually-hidden">Chat del equipo</h1>
      <Sliderbar channels={channels} canCreate={can('chat:write')} onCreate={handleCreate} />
      {currentChannel ? (
        <ChatScreen
          channel={currentChannel}
          messages={messages}
          uid={user?.uid ?? ''}
          canWrite={can('chat:write')}
          onSend={sendMessage}
        />
      ) : (
        <p className="chat__empty">Elige un canal para empezar a conversar.</p>
      )}
    </div>
  )
}
