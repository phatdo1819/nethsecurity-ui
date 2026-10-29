//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from 'vitest'
import {
  MAX_SERVER_TABS,
  WG_CONNECTIONS_TAB,
  WG_SERVERS_TAB,
  WG_TUNNELS_TAB,
  findAddedServer,
  getActiveTab,
  isServerTab,
  needsServerPicker,
  resolveSelectedTab
} from '@/lib/standalone/wireguard'

const servers = ['wg1', 'wg3']

describe('resolveSelectedTab', () => {
  it('keeps an existing server and the other tabs', () => {
    expect(resolveSelectedTab('wg3', servers)).toBe('wg3')
    expect(resolveSelectedTab(WG_TUNNELS_TAB, servers)).toBe(WG_TUNNELS_TAB)
    expect(resolveSelectedTab(WG_CONNECTIONS_TAB, servers)).toBe(WG_CONNECTIONS_TAB)
  })

  it('falls back to the first server for a removed server, nothing or an old link', () => {
    expect(resolveSelectedTab('wg2', servers)).toBe('wg1')
    expect(resolveSelectedTab('', servers)).toBe('wg1')
    expect(resolveSelectedTab(WG_SERVERS_TAB, servers)).toBe('wg1')
  })

  it('shows the servers tab when there are no servers', () => {
    expect(resolveSelectedTab('wg1', [])).toBe(WG_SERVERS_TAB)
    expect(resolveSelectedTab('', [])).toBe(WG_SERVERS_TAB)
    expect(resolveSelectedTab(WG_TUNNELS_TAB, [])).toBe(WG_TUNNELS_TAB)
  })
})

describe('isServerTab', () => {
  it('tells the server tabs from the others', () => {
    expect(isServerTab('wg1')).toBe(true)
    expect(isServerTab(WG_SERVERS_TAB)).toBe(true)
    expect(isServerTab(WG_TUNNELS_TAB)).toBe(false)
    expect(isServerTab(WG_CONNECTIONS_TAB)).toBe(false)
  })
})

describe('needsServerPicker', () => {
  it('gives each server a tab up to the limit, then a list', () => {
    expect(needsServerPicker(0)).toBe(false)
    expect(needsServerPicker(MAX_SERVER_TABS)).toBe(false)
    expect(needsServerPicker(MAX_SERVER_TABS + 1)).toBe(true)
  })
})

describe('getActiveTab', () => {
  it('highlights the tab of the server when each server has one', () => {
    expect(getActiveTab('wg3', false)).toBe('wg3')
    expect(getActiveTab(WG_TUNNELS_TAB, false)).toBe(WG_TUNNELS_TAB)
  })

  it('highlights the servers tab for any server picked from the list', () => {
    expect(getActiveTab('wg3', true)).toBe(WG_SERVERS_TAB)
    expect(getActiveTab(WG_CONNECTIONS_TAB, true)).toBe(WG_CONNECTIONS_TAB)
  })
})

describe('findAddedServer', () => {
  it('finds the server just added', () => {
    expect(findAddedServer(['wg1'], ['wg1', 'wg4'])).toBe('wg4')
  })

  it('finds nothing after an edit or a removal', () => {
    expect(findAddedServer(['wg1', 'wg3'], ['wg1', 'wg3'])).toBeUndefined()
    expect(findAddedServer(['wg1', 'wg3'], ['wg1'])).toBeUndefined()
  })
})
