// Producer-owned event contract for replaying OpenDesign read results.
import type { Branded } from '@deepseek-ai/dsh-brand'
import type {} from '@deepseek-ai/dsh-session/types'

export type OpenDesignSystemId = Branded<'OpenDesignSystemId'>

export type OpenDesignSystemSummary = {
  readonly id: OpenDesignSystemId
  readonly title: string
  readonly category?: string
  readonly summary?: string
  readonly swatches?: readonly string[]
  readonly surface?: string
  readonly source?: string
  readonly status?: string
  readonly isEditable?: boolean
  readonly createdAt?: string
  readonly updatedAt?: string
}

export type OpenDesignSystemDetail = OpenDesignSystemSummary & {
  readonly body?: string
}

export type OpenDesignListData = {
  readonly requestId: string
  readonly designSystems: readonly OpenDesignSystemSummary[]
  readonly turn: number
  readonly step: number
}

export type OpenDesignGetData = {
  readonly designSystem: OpenDesignSystemDetail
  readonly turn: number
  readonly step: number
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * A read-only OpenDesign list result was surfaced to the user.
     * @mode emit
     */
    'opendesign/list': OpenDesignListData
    /**
     * A read-only OpenDesign detail result was surfaced to the user.
     * @mode emit
     */
    'opendesign/get': OpenDesignGetData
  }
}
