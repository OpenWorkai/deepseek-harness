#!/usr/bin/env node

import {
  assertSingleTelegramCanary,
  probeTelegramStatus,
} from './status-probe.mjs'

const baseUrl = process.argv[2]
if (baseUrl === undefined) {
  process.stderr.write('usage: run-status-canary.mjs http://127.0.0.1:<port>\n')
  process.exitCode = 2
} else {
  try {
    const result = await probeTelegramStatus(baseUrl)
    process.stdout.write(`${JSON.stringify(assertSingleTelegramCanary(result))}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown failure'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}
