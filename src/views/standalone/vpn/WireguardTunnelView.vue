<script setup lang="ts">
import { NeHeading, NeTabs } from '@nethesis/vue-components'
import { useI18n } from 'vue-i18n'
import { useTabs } from '@/composables/useTabs.ts'
import WireguardServerTunnelList from '@/components/standalone/wireguard/WireguardServerTunnelList.vue'
import WireguardPeerTunnelList from '@/components/standalone/wireguard/WireguardPeerTunnelList.vue'

const { t } = useI18n()

const { tabs, selectedTab } = useTabs([
  {
    name: 'server',
    label: t('standalone.wireguard_tunnel.tabs.server')
  },
  {
    name: 'tunnel',
    label: t('standalone.wireguard_tunnel.tabs.tunnel')
  }
])

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
  authenticated?: boolean
  auth_expires?: string
  // a suspected copy of the configuration blocks the peer, if the firewall is configured so
  blocked?: boolean
  alerts?: PeerAlert[]
}

export type PeerAlert = {
  time: string
  type: 'copy' | 'lockout'
  addresses: string[]
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
}
</script>

<template>
  <div class="space-y-8">
    <NeHeading tag="h3">{{ t('standalone.wireguard_tunnel.title') }}</NeHeading>
    <NeTabs
      :selected="selectedTab"
      :sr-select-tab-label="t('ne_tabs.select_a_tab')"
      :sr-tabs-label="t('ne_tabs.tabs')"
      :tabs="tabs"
      @select-tab="selectedTab = $event"
    />
    <WireguardServerTunnelList v-if="selectedTab == 'server'" />
    <WireguardPeerTunnelList v-if="selectedTab == 'tunnel'" />
  </div>
</template>
