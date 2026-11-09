import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { conversationById, deleteConversation, openConversation, useChat } from '../../state/chat';
import { IconClose } from '../../components/icons';
import { IconButton } from '../../components/ui';
import { ChatCore } from './ChatCore';
import s from './chat.module.css';

/**
 * Independent Chat: a conversations sidebar (the Notes-page layout) and the
 * shared ChatCore. The route parameter picks the conversation, so a link into
 * a specific conversation opens exactly that one.
 */
export function ChatPage() {
  const state = useChat();
  const navigate = useNavigate();
  const { conversationId } = useParams();

  useEffect(() => {
    if (conversationId && conversationById(state, conversationId)) {
      if (state.activeId !== conversationId) openConversation(conversationId);
      return;
    }
    if (conversationId && !conversationById(state, conversationId)) {
      navigate(routes.chat(), { replace: true });
    }
  }, [conversationId, state, navigate]);

  const active = conversationId && conversationById(state, conversationId) ? conversationId : state.activeId;

  const when = (createdAt: number): string => {
    const minutes = Math.round((Date.now() - createdAt) / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / (60 * 24))}d`;
  };

  return (
    <div className={s.page} data-chat-page>
      <div className={s.pageColumns}>
        <aside className={s.sidebar} aria-label="Conversations">
          <div className={s.sidebarHead}>
            <span className={s.sidebarTitle}>Conversations</span>
            <span className={s.convWhen}>{state.conversations.length}</span>
          </div>
          {state.conversations.length === 0 ? (
            <p className={s.hint} style={{ padding: '4px 8px' }}>
              Conversations persist in this browser. The first one starts when you send a message.
            </p>
          ) : (
            state.conversations.map((conversation) => (
              <div key={conversation.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  className={s.convRow}
                  aria-current={active === conversation.id || undefined}
                  onClick={() => navigate(routes.chatConversation(conversation.id))}
                  data-conversation-row={conversation.id}
                >
                  <span className={s.convTitle}>{conversation.title}</span>
                  <span className={s.convWhen}>{when(conversation.createdAt)}</span>
                </button>
                <IconButton
                  label={`Delete ${conversation.title}`}
                  className={s.convDelete}
                  onClick={() => {
                    deleteConversation(conversation.id);
                    if (active === conversation.id) navigate(routes.chat(), { replace: true });
                  }}
                >
                  <IconClose size={11} />
                </IconButton>
              </div>
            ))
          )}
        </aside>

        <div className={s.main}>
          <ChatCore />
        </div>
      </div>
    </div>
  );
}
