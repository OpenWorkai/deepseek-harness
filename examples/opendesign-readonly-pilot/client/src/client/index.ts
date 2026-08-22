// Browser half of the OpenDesign read-only pilot plugin.
//
// SCAFFOLD — not yet composed into the web bundle. The event stream is the
// replay source; component state is not authoritative.
import { createElement } from 'react'
import type {
  ChatConversationViewNode,
  ClientContext,
  ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  OpenDesignGetData,
  OpenDesignListData,
  OpenDesignSystemDetail,
} from '../events.js'

const OPENDESIGN_NS = 'opendesign-pilot'

type OpenDesignNodeState =
  | { readonly mode: 'list'; readonly data: OpenDesignListData }
  | { readonly mode: 'detail'; readonly data: OpenDesignGetData }

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    'opendesign-result': OpenDesignNodeState
  }
}

const openDesignResultDefinition: ConversationNodeDefinition<OpenDesignNodeState> = {
  kind: 'opendesign-result',
  target: 'chat',
  match: (event) => {
    if (event.type === 'opendesign/list') {
      return { id: `list:${event.data.requestId}`, role: 'start' }
    }
    if (event.type === 'opendesign/get') {
      return { id: String(event.data.designSystem.id), role: 'start' }
    }
    return null
  },
  start: (_context, match) => {
    if (match.event.type === 'opendesign/list') {
      return { mode: 'list', data: match.event.data }
    }
    if (match.event.type === 'opendesign/get') {
      return { mode: 'detail', data: match.event.data }
    }
    throw new Error('opendesign-result start requires an OpenDesign read event')
  },
  update: context => context.state,
  buildViewNode: (context): ChatConversationViewNode | null => {
    if (context.start === undefined || context.state === undefined) return null
    return {
      key: context.key,
      kind: 'opendesign-result',
      id: context.id,
      target: 'chat',
      anchorSeq: context.start.event.seq,
      location: context.start.location,
      visibility: 'visible',
      data: context.state,
    }
  },
}

function detailRows(designSystem: OpenDesignSystemDetail) {
  return [
    createElement('div', { key: 'id' }, `id: ${designSystem.id}`),
    designSystem.category === undefined
      ? null
      : createElement('div', { key: 'category' }, `category: ${designSystem.category}`),
    designSystem.body === undefined
      ? null
      : createElement('pre', { key: 'body' }, designSystem.body),
  ]
}

function OpenDesignResultCard(props: PropsRuntime<'conversation.chat.node', 'opendesign-result'>) {
  const state = props.node.data
  if (state.mode === 'list') {
    return createElement(
      'div',
      { className: 'opendesign-result-node' },
      createElement('strong', null, 'OpenDesign design systems'),
      createElement(
        'ul',
        null,
        ...state.data.designSystems.map(item =>
          createElement('li', { key: item.id }, `${item.title} (${item.id})`),
        ),
      ),
    )
  }
  return createElement(
    'div',
    { className: 'opendesign-result-node' },
    createElement('strong', null, state.data.designSystem.title),
    ...detailRows(state.data.designSystem),
  )
}

function OpenDesignSettingsCard() {
  return createElement(
    'div',
    { className: 'opendesign-settings-card' },
    'OpenDesign pilot: loopback-only, list/get read access.',
  )
}

export const inject = ['slots', 'conversationEvents']

export function apply(ctx: ClientContext): void {
  ctx.conversationEvents.register(openDesignResultDefinition)
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'opendesign-result',
  }, OpenDesignResultCard))

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: OPENDESIGN_NS,
  }, OpenDesignSettingsCard))
}
