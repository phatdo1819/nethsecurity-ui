//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from 'vitest'
import {
  MAX_SERVER_TABS,
  RW_HISTORY_TAB,
  RW_SERVERS_TAB,
  buildHistoryExportParams,
  getActiveTab,
  needsServerPicker,
  resolveSelectedTab,
  getServerLabel,
  type RWInstanceDetails
} from '@/lib/standalone/openvpnRw'

const servers: RWInstanceDetails[] = [
  { instance: 'ns_roadwarrior1', description: 'Employees', enabled: '1', user_db: 'main' },
  { instance: 'ns_roadwarrior2', description: '', enabled: '1', user_db: 'main' }
]

describe('getServerLabel', () => {
  it('never exposes the internal identifier for an unconfigured server', () => {
    expect(getServerLabel(servers[1]!, 'New server')).toBe('New server')
  })

  it('treats a whitespace-only description as missing', () => {
    expect(getServerLabel({ ...servers[1]!, description: '   ' }, 'New server')).toBe('New server')
  })

  it('uses the name chosen by the administrator', () => {
    expect(getServerLabel(servers[0]!, 'New server')).toBe('Employees')
  })
})

describe('resolveSelectedTab', () => {
  const ids = servers.map((s) => s.instance)

  it('falls back to the first server when the selected one has been removed', () => {
    expect(resolveSelectedTab('ns_roadwarrior9', ids)).toBe('ns_roadwarrior1')
  })

  it('falls back to the first server when nothing is selected', () => {
    expect(resolveSelectedTab('', ids)).toBe('ns_roadwarrior1')
  })

  it('does not mistake an unknown value for the history tab', () => {
    expect(resolveSelectedTab('connection-history ', ids)).toBe('ns_roadwarrior1')
  })

  it('returns an empty string when there are no servers', () => {
    expect(resolveSelectedTab('ns_roadwarrior1', [])).toBe('')
    expect(resolveSelectedTab(RW_HISTORY_TAB, [])).toBe('')
  })

  it('keeps the history tab and an existing server', () => {
    expect(resolveSelectedTab(RW_HISTORY_TAB, ids)).toBe(RW_HISTORY_TAB)
    expect(resolveSelectedTab('ns_roadwarrior2', ids)).toBe('ns_roadwarrior2')
  })
})

describe('needsServerPicker', () => {
  it('gives each server a tab up to the limit', () => {
    expect(needsServerPicker(0)).toBe(false)
    expect(needsServerPicker(MAX_SERVER_TABS)).toBe(false)
  })

  it('switches to a list above the limit', () => {
    expect(needsServerPicker(MAX_SERVER_TABS + 1)).toBe(true)
  })
})

describe('getActiveTab', () => {
  it('highlights the tab of the server when each server has a tab', () => {
    expect(getActiveTab('ns_roadwarrior2', false)).toBe('ns_roadwarrior2')
    expect(getActiveTab(RW_HISTORY_TAB, false)).toBe(RW_HISTORY_TAB)
  })

  it('highlights the servers tab for any server when they are selected from a list', () => {
    expect(getActiveTab('ns_roadwarrior2', true)).toBe(RW_SERVERS_TAB)
    expect(getActiveTab('ns_roadwarrior12', true)).toBe(RW_SERVERS_TAB)
  })

  it('keeps the history tab and the empty selection with the list', () => {
    expect(getActiveTab(RW_HISTORY_TAB, true)).toBe(RW_HISTORY_TAB)
    expect(getActiveTab('', true)).toBe('')
  })
})

describe('buildHistoryExportParams', () => {
  const all = ['ns_roadwarrior1', 'ns_roadwarrior2', 'ns_roadwarrior3']

  it('exports all the servers when no filter is selected', () => {
    expect(buildHistoryExportParams([], all)).toEqual({})
  })

  it('exports all the servers when every server is selected', () => {
    expect(buildHistoryExportParams([...all], all)).toEqual({})
  })

  it('exports a single server using the instance parameter', () => {
    expect(buildHistoryExportParams(['ns_roadwarrior2'], all)).toEqual({
      instance: 'ns_roadwarrior2'
    })
  })

  it('exports a subset of the servers', () => {
    expect(buildHistoryExportParams(['ns_roadwarrior1', 'ns_roadwarrior3'], all)).toEqual({
      instances: ['ns_roadwarrior1', 'ns_roadwarrior3']
    })
  })

  it('ignores servers that do not exist anymore', () => {
    // a removed server left in the route must not turn into an export of nothing
    expect(buildHistoryExportParams(['ns_roadwarrior9'], all)).toEqual({})
    expect(buildHistoryExportParams(['ns_roadwarrior9', 'ns_roadwarrior1'], all)).toEqual({
      instance: 'ns_roadwarrior1'
    })
  })
})
