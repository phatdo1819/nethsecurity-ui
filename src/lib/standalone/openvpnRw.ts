//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Details of an OpenVPN Road Warrior server, as returned by `ns.ovpnrw list-instances`.
 * `instance` is an internal identifier (e.g. ns_roadwarrior1): it must never be shown to the user,
 * use `getServerLabel` instead.
 */
export type RWInstanceDetails = {
  instance: string
  description: string
  enabled: string
  user_db: string
}

/** Name of the tab showing the connection history of all the servers */
export const RW_HISTORY_TAB = 'connection-history'

/**
 * Name of a server, chosen by the administrator when the server has been created.
 * @param server the server
 * @param fallback label used for servers that have not been configured yet
 */
export function getServerLabel(server: RWInstanceDetails, fallback: string): string {
  return server.description?.trim() ? server.description : fallback
}

/**
 * Return the tab that must be shown, given the one stored inside the route.
 * A server that has been removed, or an unknown value, selects the first server.
 * @param selected tab name stored inside the route
 * @param instances identifiers of the available servers
 */
export function resolveSelectedTab(selected: string, instances: string[]): string {
  if (instances.length === 0) {
    return ''
  }
  if (selected === RW_HISTORY_TAB || instances.includes(selected)) {
    return selected
  }
  return instances[0]!
}

/**
 * Build the parameters of the `connection-history-csv` call, so the export matches the servers
 * selected inside the history filter.
 * @param selected identifiers of the servers selected by the user, empty to select all of them
 * @param all identifiers of all the available servers
 */
export function buildHistoryExportParams(
  selected: string[],
  all: string[]
): { instance?: string; instances?: string[] } {
  // ignore servers removed in the meantime
  const existing = selected.filter((instance) => all.includes(instance))

  if (existing.length === 0 || existing.length === all.length) {
    return {}
  }
  if (existing.length === 1) {
    return { instance: existing[0]! }
  }
  return { instances: existing }
}
