// events.ts — producer-owned event contract for the Jiwo pilot conversation node.
//
// Per adding-a-conversation-node.md, every event that builds one Node must
// carry a stable business id. The Jiwo adapter (which observes the
// mcp__jiwo__* tool results) emits these events; the client plugin only
// consumes them to render a replayable node. Model-visible state therefore
// lives in the session event stream, not in transient component state.
import type { Branded } from '@deepseek-ai/dsh-brand'

export type JiwoNoteId = Branded<'JiwoNoteId'>

export interface JiwoReadData {
  readonly noteId: JiwoNoteId
  readonly turn: number
  readonly step: number
  readonly title: string
  readonly tags: readonly string[]
}

export interface JiwoTagWriteData {
  readonly noteId: JiwoNoteId
  readonly tag: string
  readonly confirmed: boolean
  readonly changed: boolean
  readonly turn: number
  readonly step: number
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * A note was read from Jiwo and surfaced to the user.
     * @mode emit
     */
    'jiwo/read': JiwoReadData
    /**
     * A confirmed, idempotent tag write landed on Jiwo.
     * @mode emit
     */
    'jiwo/tag_write': JiwoTagWriteData
  }
}
