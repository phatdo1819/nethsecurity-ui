//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

/** Name of the tab of the peer tunnels: the connections of this firewall to other WireGuard servers */
export const WG_TUNNELS_TAB = 'tunnel'

/** Name of the tab showing the connection history of all the servers */
export const WG_CONNECTIONS_TAB = 'connections'

/**
 * Name of the tab of the servers when there are none, or too many to have a tab each. It's also the name of the
 * former tab of all the servers: an old link opens the first server.
 */
export const WG_SERVERS_TAB = 'server'

/** Maximum number of servers having a tab each: with more servers, they are selected from a list */
export const MAX_SERVER_TABS = 5

/**
 * Tell if the servers must be selected from a list, instead of having a tab each.
 * @param count number of servers
 */
export function needsServerPicker(count: number): boolean {
  return count > MAX_SERVER_TABS
}

/**
 * Tell if a tab shows a server, or how to add one.
 * @param tab name of the tab, the identifier of a server or one of the other tabs
 */
export function isServerTab(tab: string): boolean {
  return tab !== WG_TUNNELS_TAB && tab !== WG_CONNECTIONS_TAB
}

/**
 * Return the tab that must be shown, given the one stored inside the route. A server that has been removed, an
 * unknown value or the servers tab select the first server; without servers, the servers tab shows how to add one.
 * @param selected tab name stored inside the route
 * @param servers identifiers of the available servers
 */
export function resolveSelectedTab(selected: string, servers: string[]): string {
  if (!isServerTab(selected) || servers.includes(selected)) {
    return selected
  }
  return servers[0] ?? WG_SERVERS_TAB
}

/**
 * Return the tab to highlight in the tab bar.
 * @param selected selected tab, see `resolveSelectedTab`
 * @param serverPicker true if the servers are selected from a list: they all share the servers tab
 */
export function getActiveTab(selected: string, serverPicker: boolean): string {
  return serverPicker && isServerTab(selected) ? WG_SERVERS_TAB : selected
}

/**
 * Return the server that a new list has and an earlier one hadn't: the server just added.
 * @param before identifiers of the servers before the change
 * @param after identifiers of the servers after the change
 */
export function findAddedServer(before: string[], after: string[]): string | undefined {
  return after.find((id) => !before.includes(id))
}
