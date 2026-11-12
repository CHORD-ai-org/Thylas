import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { historyFor, streamChat } from '../../services/ai/stream';
import type { AiErr } from '../../lib/ai';
import {
  activeConversation,
  addUserMessage,
  appendDelta,
  beginAssistantMessage,
  clearConversation,
  conversationNow,
  dropLastAssistant,
  finishAssistantMessage,
  newConversation,
  openConversation,
  useChat,
  type Block,
  type Conversation,
} from '../../state/chat';
import { Button, IconButton } from '../../components/ui';
import { IconCheck, IconChat, IconCopy, IconPlus } from '../../components/icons';
import { Composer } from './Composer';
import { MarkdownBody } from './Markdown';
import s from './chat.module.css';

/**
 * ChatCore is the whole interaction — header, stream, composer — shared by the
 * /chat page and the dock. Streaming controllers live here, keyed by
 * conversation, so a stop from either surface aborts the same request.
 */
const controllers = new Map<string, AbortController>();

/** What the reader can do about each failure kind. The server says what
    happened; this says what to do next (same table as the Ask panel). */
const NEXT_STEP: Record<AiErr['kind'], string> = {
  not_configured: 'Set the key, restart the dev server, then ask again.',
  unauthorized: 'Fix the key; this answer will not change until you do.',
  rate_limited: 'Wait for the window to pass, then ask again.',
  timeout: 'The model did not answer in time. Asking again is reasonable.',
  network: 'Check that the machine is online.',
  upstream: 'The model returned an error. Asking once more is reasonable.',
  contract: 'Nothing to retry — the reply did not match the agreed shape.',
};

function plainTextOf(message: Conversation['messages'][number]): string {
  return message.blocks
    .filter((b): b is Extract<Block, { kind: 'text' }> => b.kind === 'text')
    .map((b) => b.text)
    .join('\n\n');
}

export function ChatCore({ embedded = false, headerExtra }: { embedded?: boolean; headerExtra?: React.ReactNode }) {
  const state = useChat();
  const conversation = activeConversation(state);
  const streamRef = useRef<HTMLDivElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const lastMessage = conversation?.messages.at(-1) ?? null;
  const streaming =
    lastMessage?.role === 'assistant' && lastMessage.blocks.some((b) => b.kind === 'text' && b.streaming);

  /* Follow the stream only while the reader is already at the bottom; a scroll
     up during generation is a reader's choice, not a scroll-jack. */
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    if (streaming) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      if (nearBottom) el.scrollTop = el.scrollHeight;
    }
  }, [conversation?.messages, streaming]);

  const send = useCallback((prompt: string, conversationId: string) => {
    addUserMessage(conversationId, prompt);
    const assistant = beginAssistantMessage(conversationId);
    const controller = new AbortController();
    controllers.set(conversationId, controller);
    const current = conversationNow(conversationId);
    const history = current
      ? historyFor(
          current.messages
            .filter((m) => m.id !== assistant.id)
            .map((m) => ({ role: m.role, text: plainTextOf(m) })),
        )
      : [];
    void streamChat(prompt, history, controller.signal, (chunk) => {
      appendDelta(conversationId, assistant.id, chunk);
    }).then((result) => {
      controllers.delete(conversationId);
      if (result.ok) {
        finishAssistantMessage(
          conversationId,
          assistant.id,
          result.stopped ? { stopped: true } : { model: result.model || 'deepseek-chat', ms: result.ms },
        );
      } else {
        finishAssistantMessage(conversationId, assistant.id, { error: result.error });
      }
    });
  }, []);

  const stop = useCallback(() => {
    if (!conversation) return;
    controllers.get(conversation.id)?.abort();
  }, [conversation]);

  const regenerate = useCallback(() => {
    if (!conversation) return;
    const lastUser = [...conversation.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const prompt = plainTextOf(lastUser);
    if (!prompt.trim()) return;
    controllers.get(conversation.id)?.abort();
    dropLastAssistant(conversation.id);
    send(prompt, conversation.id);
  }, [conversation, send]);

  if (!conversation) {
    return (
      <div className={s.chat}>
        <div className={s.stream} style={{ display: 'flex' }}>
          <div className={s.streamEmpty}>
            <p className={s.streamEmptyTitle}>No conversation yet.</p>
            <p className={s.streamEmptyHint}>Start one — it opens here and in the dock, wherever you are.</p>
            <div style={{ marginTop: 16 }}>
              <Button size="sm" variant="primary" onClick={() => openConversation(newConversation().id)}>
                New conversation
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const landing = conversation.messages.length === 0;

  return (
    <div className={[s.chat, landing ? s.chatLanding : ''].join(' ')} data-chat-embedded={embedded || undefined}>
      <header className={s.header}>
        <span className={s.headerTitle} title={conversation.title}>
          {conversation.title}
        </span>
        <span className={s.headerMeta}>
          {conversation.context.length > 0 ? `${conversation.context.length} context` : 'no context'}
        </span>
        <span className={s.headerActions}>
          {headerExtra}
          <IconButton label="New conversation" onClick={() => openConversation(newConversation().id)}>
            <IconPlus size={13} />
          </IconButton>
          {confirmingClear ? (
            <span role="group" aria-label="Clear conversation" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span className={s.hint}>Clear this conversation?</span>
              <Button
                size="sm"
                onClick={() => {
                  clearConversation(conversation.id);
                  setConfirmingClear(false);
                }}
              >
                Clear
              </Button>
              <Button size="sm" onClick={() => setConfirmingClear(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button size="sm" onClick={() => setConfirmingClear(true)} disabled={conversation.messages.length === 0}>
              Clear
            </Button>
          )}
        </span>
      </header>

      <div className={s.stream} ref={streamRef} data-chat-stream>
        <div className={s.thread}>
          {conversation.messages.length === 0 ? (
            <div className={s.streamEmpty}>
              <p className={s.streamEmptyTitle}>Ask about this workspace.</p>
              <p className={s.streamEmptyHint}>
                Attach notes, files or whiteboards as context — the assistant receives what you
                declare, and nothing is read automatically. Code in answers can be saved as a real
                note.
              </p>
            </div>
          ) : (
            conversation.messages.map((message, index) => (
              <Turn
                key={message.id}
                message={message}
                isLast={index === conversation.messages.length - 1}
                streaming={streaming === true}
                onRegenerate={regenerate}
              />
            ))
          )}
        </div>
      </div>

      <Composer
        conversation={conversation}
        streaming={streaming === true}
        onSend={(text) => send(text, conversation.id)}
        onStop={stop}
      />
    </div>
  );
}

/* ---- one turn --------------------------------------------------------------- */

function Turn({
  message,
  isLast,
  streaming,
  onRegenerate,
}: {
  message: Conversation['messages'][number];
  isLast: boolean;
  streaming: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const plainText = useMemo(() => plainTextOf(message), [message]);

  const copy = () => {
    void navigator.clipboard?.writeText(plainText).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  const empty = message.role === 'assistant' && plainText === '' && message.blocks.some((b) => b.kind === 'text' && b.streaming);

  return (
    <div className={s.turn} data-role={message.role} data-message-role={message.role}>
      <div className={s.turnHead}>
        <span>{message.role === 'user' ? 'You' : 'Assistant'}</span>
        <span className={s.turnActions}>
          <IconButton label={copied ? 'Copied' : 'Copy message'} onClick={copy}>
            {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
          </IconButton>
          {message.role === 'user' && isLast && !streaming ? (
            <IconButton label="Regenerate answer" onClick={onRegenerate}>
              <IconChat size={12} />
            </IconButton>
          ) : null}
        </span>
      </div>

      <div className={s.blocks}>
        {empty ? <span className={s.statusLine}>Generating…</span> : null}
        {message.blocks.map((block, index) => (
          <MessageBlock
            key={index}
            block={block}
            caret={block.kind === 'text' && block.streaming === true && index === message.blocks.length - 1}
          />
        ))}
        {message.meta ? (
          <p className={s.foot}>
            {message.meta.model} · dev endpoint · {message.meta.ms} ms
          </p>
        ) : null}
        {message.error ? (
          <div className={s.error} role="alert">
            <p>{message.error.message}</p>
            <p className={s.errorNext}>{NEXT_STEP[message.error.kind]}</p>
            {message.error.retryable && isLast && !streaming ? (
              <div style={{ marginTop: 8 }}>
                <Button size="sm" onClick={onRegenerate}>
                  Regenerate
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageBlock({ block, caret }: { block: Block; caret: boolean }) {
  if (block.kind === 'text') {
    return <MarkdownBody source={block.text} caret={caret} />;
  }
  if (block.kind === 'evidence') {
    return (
      <div className={s.evidenceRow}>
        <span className={s.evidence} title={block.sourceType}>
          {block.sourceType} · {block.name}
        </span>
      </div>
    );
  }
  if (block.kind === 'status') {
    return <span className={s.statusLine}>{block.label}</span>;
  }
  /* artifact blocks are produced only by future tool flows; the renderer keeps
     the contract without faking one. */
  return (
    <div className={s.code} data-artifact>
      <div className={s.codeHead}>
        <span>{block.title}</span>
      </div>
      <pre className={s.codeText}>{block.content}</pre>
    </div>
  );
}
