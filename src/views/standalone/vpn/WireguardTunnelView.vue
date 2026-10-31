<script setup lang="ts">
import {
  NeCombobox,
  NeHeading,
  NeTabs,
  type NeComboboxOption,
  type Tab
} from '@nethesis/vue-components'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { useRouteQuery } from '@vueuse/router'
import type { AxiosResponse } from 'axios'
import { ubusCall } from '@/lib/standalone/ubus.ts'
import {
  WG_CONNECTIONS_TAB,
  WG_SERVERS_TAB,
  WG_TUNNELS_TAB,
  findAddedServer,
  getActiveTab,
  isServerTab,
  needsServerPicker,
  resolveSelectedTab
} from '@/lib/standalone/wireguard.ts'
import { useUciPendingChangesStore } from '@/stores/standalone/uciPendingChanges.ts'
import WireguardServerTunnelList from '@/components/standalone/wireguard/WireguardServerTunnelList.vue'
import WireguardPeerTunnelList from '@/components/standalone/wireguard/WireguardPeerTunnelList.vue'
import WireguardConnectionsHistory from '@/components/standalone/wireguard/WireguardConnectionsHistory.vue'

const { t } = useI18n()
const changes = useUciPendingChangesStore()

// the servers, one tab each, like the servers of OpenVPN Road Warrior
const loading = ref(true)
const error = ref<Error>()
const instances = ref<Tunnel[]>([])

type ListInstancesResponse = {
  instances: Tunnel[]
}

// the calls not answered yet: the polling waits for them, a busy firewall can take longer than its interval
let pendingCalls = 0
// only the answer of the last call is shown: an older one answered late, like a poll sent before a server was
// saved, would bring back what was there before
let lastCall = 0

function fetchServers(): Promise<unknown> {
  const call = ++lastCall
  error.value = undefined
  pendingCalls++
  return ubusCall<AxiosResponse<ListInstancesResponse>>('ns.wireguard', 'list-servers')
    .then((response) => {
      if (call == lastCall) {
        instances.value = response.data.instances
      }
    })
    .catch((err) => {
      if (call == lastCall) {
        error.value = err
      }
    })
    .finally(() => {
      loading.value = false
      pendingCalls--
    })
}

// the selected tab is stored inside the route: the identifier of a server, or one of the other tabs
const tabFromRoute = useRouteQuery<string>('tab', '')
const serverIds = computed(() => instances.value.map((instance) => instance.id))
const selectedTab = computed({
  get: () => resolveSelectedTab(tabFromRoute.value, serverIds.value),
  set: (value: string) => {
    tabFromRoute.value = value
  }
})
const showsServer = computed(() => isServerTab(selectedTab.value))
const selectedServer = computed(() =>
  instances.value.find((instance) => instance.id == selectedTab.value)
)

// after the drawer of a server: the server just added is selected
async function refreshServers(serverSaved = false) {
  const before = serverIds.value
  await Promise.all([changes.getChanges(), fetchServers()])
  const added = serverSaved ? findAddedServer(before, serverIds.value) : undefined
  if (added) {
    selectedTab.value = added
  }
}

// the servers are looked at every few seconds only while one is shown, and not while the browser tab is hidden
const REFRESH_SECONDS = 10
const visibility = useDocumentVisibility()

function poll() {
  if (pendingCalls == 0 && visibility.value == 'visible') {
    fetchServers()
  }
}

const { pause, resume } = useIntervalFn(poll, REFRESH_SECONDS * 1000, {
  immediate: false,
  immediateCallback: true
})

// back on the browser tab: the data of the time it was hidden at once
watch(visibility, (value) => {
  if (value == 'visible' && showsServer.value) {
    poll()
  }
})
watch(
  showsServer,
  (shown) => {
    if (shown) {
      resume()
    } else {
      pause()
      // once, for the names of the tabs
      if (loading.value) {
        fetchServers()
      }
    }
  },
  { immediate: true }
)

// with many servers a tab each doesn't fit: they share a tab and are selected from a list
const serverPicker = computed(() => needsServerPicker(instances.value.length))

const serverOptions = computed<NeComboboxOption[]>(() =>
  instances.value.map((instance) => ({
    id: instance.id,
    label: instance.name || instance.id,
    description: instance.enabled ? undefined : t('common.disabled')
  }))
)

const tabs = computed<Tab[]>(() => [
  ...(instances.value.length == 0 || serverPicker.value
    ? [
        {
          name: WG_SERVERS_TAB,
          label: serverPicker.value
            ? t('standalone.wireguard_tunnel.tabs.servers')
            : t('standalone.wireguard_tunnel.tabs.server')
        }
      ]
    : serverOptions.value.map((option) => ({ name: option.id, label: option.label }))),
  { name: WG_TUNNELS_TAB, label: t('standalone.wireguard_tunnel.tabs.tunnel') },
  { name: WG_CONNECTIONS_TAB, label: t('standalone.wireguard_tunnel.tabs.connections') }
])

// server shown when coming back to the servers tab
const lastServer = ref('')
watch(
  selectedTab,
  (value) => {
    if (serverIds.value.includes(value)) {
      lastServer.value = value
    }
  },
  { immediate: true }
)

function onSelectTab(name: string) {
  if (name == WG_SERVERS_TAB) {
    // an empty value selects the first server
    selectedTab.value = serverIds.value.includes(lastServer.value) ? lastServer.value : ''
  } else {
    selectedTab.value = name
  }
}

function onSelectServer(id: string) {
  // the list can be cleared: keep the current server
  if (serverIds.value.includes(id)) {
    selectedTab.value = id
  }
}

export type BasePeer = {
  id: string
  enabled: boolean
  name: string
  pre_shared_key: boolean
  route_all_traffic: boolean
  remote_networks: string[]
  local_networks: string[]
  reserved_ip: string
  config: string
  mtu?: number
  active: false
  latest_handshake?: string
  // login with user credentials, only on servers with auth_mode other than 'key'
  user?: string
  // the user doesn't exist anymore: the peer can't log in
  user_missing?: boolean
  authenticated?: boolean
  auth_expires?: string
  // a suspected copy of the configuration blocks the peer, if the firewall is configured so
  blocked?: boolean
  alerts?: PeerAlert[]
  // only on servers with device binding
  device?: PeerDevice
}

export type PeerAlert = {
  time: string
  type: 'copy' | 'lockout' | 'device_mismatch'
  addresses: string[]
}

export type PeerDevice = {
  state: 'enrolled' | 'waiting' | 'closed'
  // while waiting
  enrollment_until?: string
  // once enrolled
  name?: string
  kind?: string
  machine_id?: boolean
  enrolled?: string
  last_used?: string
  from?: string
}

export type ActivePeer = BasePeer & {
  active: true
  latest_handshake: string
}

export type Peer = BasePeer | ActivePeer

export type WireguardAuthMode = 'key' | 'key_password' | 'key_password_otp'

export type Tunnel = {
  id: string
  address: string
  client_to_client: boolean
  enabled: boolean
  listen_port: number
  name: string
  network: string
  peers: Peer[]
  public_endpoint: string
  // missing on firewalls without fallback endpoints
  fallback_endpoints?: string[]
  route_all_traffic: boolean
  routes: string[]
  mtu: number
  dns: string[]
  // missing on firewalls without the login feature
  auth_mode?: WireguardAuthMode
  user_db?: string
  auth_timeout?: number
  login_url?: string
  auth_enforced?: boolean
  auth_blocked?: boolean
  // missing on firewalls without device binding
  device_binding?: boolean
  machine_id?: boolean
}
</script>

<template>
  <div class="space-y-8">
    <NeHeading tag="h3">{{ t('standalone.wireguard_tunnel.title') }}</NeHeading>
    <!-- long server names can exceed the page width: scroll the tab bar instead of the page -->
    <div class="overflow-x-auto">
      <NeTabs
        :selected="getActiveTab(selectedTab, serverPicker)"
        :sr-select-tab-label="t('ne_tabs.select_a_tab')"
        :sr-tabs-label="t('ne_tabs.tabs')"
        :tabs="tabs"
        @select-tab="onSelectTab"
      />
    </div>
    <template v-if="showsServer">
      <NeCombobox
        v-if="serverPicker"
        :model-value="selectedTab"
        :label="t('standalone.wireguard_tunnel.server')"
        :options="serverOptions"
        :no-options-label="t('ne_combobox.no_options_label')"
        :no-results-label="t('ne_combobox.no_results')"
        :optional-label="t('common.optional')"
        :selected-label="t('ne_combobox.selected')"
        :limited-options-label="t('ne_combobox.limited_options_label')"
        :user-input-label="t('ne_combobox.user_input_label')"
        class="max-w-md"
        @update:model-value="onSelectServer"
      />
      <WireguardServerTunnelList
        :instance="selectedServer"
        :loading="loading"
        :error="error"
        :refresh-seconds="REFRESH_SECONDS"
        :reload="fetchServers"
        :refresh="refreshServers"
      />
    </template>
    <WireguardPeerTunnelList v-else-if="selectedTab == WG_TUNNELS_TAB" />
    <WireguardConnectionsHistory v-else />
  </div>
</template>
