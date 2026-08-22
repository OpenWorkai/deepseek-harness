// Browser half of the Jiwo pilot plugin.
//
// SCAFFOLD — not yet composed into the web bundle (see README "Composing the
// client plugin"). Follows adding-a-settings-card.md (card) and
// adding-a-conversation-node.md (replayable node). Verify the exact
// ConversationNodeDefinition reducer method name (`update`/`reduce`) against
// the installed @deepseek-ai/dsh-client-runtime/client type when you compose.
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatNodeViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls in the keyed slot's declaration. Value imports across
// plugins are rejected by the bundle-purity gate, so the card renders its own.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'

// Re-declare the namespace key locally (do NOT value-import the Host half).
const JIWO_NS = 'jiwo-pilot'

// --- Replayable conversation node -----------------------------------------
interface JiwoNodeState {
  readonly noteId: string
  readonly title?: string
  readonly tags: readonly string[]
  readonly lastWrite?: { tag: string; changed: boolean }
  readonly turn: number
  readonly step: number
}

interface JiwoChatData {
  readonly noteId: string
  readonly title?: string
  readonly tags: readonly string[]
  readonly lastWrite?: { tag: string; changed: boolean }
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    'jiwo-result': JiwoChatData
  }
}

function viewData(s: JiwoNodeState): JiwoChatData {
  const out: JiwoChatData = { noteId: s.noteId, title: s.title, tags: s.tags }
  if (s.lastWrite) out.lastWrite = s.lastWrite
  return out
}

// Definition body sketched from adding-a-conversation-node.md. Confirm the
// reducer method name against the runtime type when composing. Event/match
// shapes are scaffolded with local structural types + `unknown` narrowing
// (the bundle-purity gate forbids value imports across plugins, and the exact
// runtime SessionEventMap union is verified when this is composed).
type JiwoReadEvent = {
  type: 'jiwo/read'
  data: { noteId: string | number; title?: string; tags: readonly string[]; turn: number; step: number }
}
type JiwoTagWriteEvent = {
  type: 'jiwo/tag_write'
  data: { noteId: string | number; tag: string; changed: boolean }
}
type JiwoSessionEvent = JiwoReadEvent | JiwoTagWriteEvent
type JiwoMatch = { event: JiwoSessionEvent }

const jiwoResultDefinition = {
  kind: 'jiwo-result',
  target: 'chat',
  match: (event: unknown) => {
    const ev = event as JiwoSessionEvent
    if (ev.type === 'jiwo/read') return { id: String(ev.data.noteId), role: 'start' }
    if (ev.type === 'jiwo/tag_write') return { id: String(ev.data.noteId), role: 'update' }
    return null
  },
  start: (_ctx: unknown, match: unknown) => {
    const m = match as JiwoMatch
    if (m.event.type !== 'jiwo/read') throw new Error('jiwo-result requires jiwo/read')
    const d = m.event.data
    return { noteId: String(d.noteId), title: d.title, tags: d.tags, turn: d.turn, step: d.step }
  },
  update: (state: JiwoNodeState, match: unknown) => {
    const m = match as JiwoMatch
    if (m.event.type === 'jiwo/tag_write') {
      const d = m.event.data
      return {
        ...state,
        lastWrite: { tag: d.tag, changed: d.changed },
      }
    }
    return state
  },
  view: (state: JiwoNodeState): JiwoChatData => viewData(state),
} as const

function JiwoResultCard(props: ChatNodeViewProps<JiwoChatData>) {
  const d = props.data
  return createElement(
    'div',
    { className: 'jiwo-result-node' },
    createElement('strong', null, `Jiwo note: ${d.title ?? d.noteId}`),
    createElement('div', null, `tags: ${d.tags.join(', ')}`),
    d.lastWrite
      ? createElement('div', null, `tag write: ${d.lastWrite.tag} (${d.lastWrite.changed ? 'added' : 'no-op'})`)
      : null,
  )
}

// --- Settings card ---------------------------------------------------------
function JiwoSettingsCard() {
  return createElement('div', { className: 'jiwo-settings-card' }, 'Jiwo pilot: stub backend active.')
}

export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

export function apply(ctx: ClientContext): void {
  // Register the replayable conversation node (reads jiwo/read + jiwo/tag_write).
  ctx.slots?.inject('conversation.node', () =>
    ctx.slots.register({
      name: 'conversation.node',
      key: 'jiwo-result',
      definition: jiwoResultDefinition,
      view: JiwoResultCard,
    }),
  )

  // Register the settings card under the Host-served namespace.
  ctx.slots?.inject('settings.plugin.item', () =>
    ctx.slots.register({
      name: 'settings.plugin.item',
      key: JIWO_NS,
      locale: 'settings.jiwoPilot',
      inject: () => JiwoSettingsCard(),
    }),
  )
}
