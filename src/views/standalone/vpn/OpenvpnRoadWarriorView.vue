<!--
  Copyright (C) 2024 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouteQuery } from '@vueuse/router'
import {
  NeHeading,
  NeButton,
  NeSkeleton,
  NeInlineNotification,
  NeEmptyState,
  NeTabs,
  getAxiosErrorMessage,
  type Tab
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faGlobe, faPlus, faWrench } from '@fortawesome/free-solid-svg-icons'
import { ubusCall } from '@/lib/standalone/ubus'
import {
  RW_HISTORY_TAB,
  getServerLabel,
  resolveSelectedTab,
  type RWInstanceDetails
} from '@/lib/standalone/openvpnRw'
import { useUciPendingChangesStore } from '@/stores/standalone/uciPendingChanges'
import RWServerTab from '@/components/standalone/openvpn_rw/RWServerTab.vue'
import ConnectionsHistory from '@/components/standalone/openvpn_rw/ConnectionsHistory.vue'

export type RWAuthenticationMode =
  'username_password' | 'certificate' | 'username_password_certificate' | 'username_otp_certificate'

export type RWServer = {
  proto: string
  port: string
  dev_type: string
  topology: string
  enabled: string
  client_to_client: string
  auth: string
  cipher: string
  tls_version_min: string
  ns_auth_mode: RWAuthenticationMode
  ns_bridge?: string
  server: string
  ns_public_ip: string[]
  ns_redirect_gateway: string
  ns_local: string[]
  ns_dhcp_options: { option: string; value: string }[]
  ns_pool_start?: string
  ns_pool_end?: string
  ns_user_db: string
  compress?: string
  ns_description: string
  ifconfig_pool?: string[]
  certificates: {
    CA?: number
    server?: number
  }
  tun_mtu: string
  mssfix: string
}

export type RWAccount = {
  local: boolean
  database: string
  name: string
  password: string
  description: string
  openvpn_enabled: '0' | '1'
  openvpn_ipaddr: string
  openvpn_2fa: string
  admin: boolean
  id: string
  connected: boolean
  expiration: string | number
  expired: boolean
  real_address?: string
  virtual_address?: string
  bytes_received?: string
  bytes_sent?: string
  since?: number
  used: boolean
  matches: string[]
  valid?: boolean
}

type ListInstancesResponse = {
  data: {
    instances: string[]
    details: RWInstanceDetails[]
  }
}

type AddInstanceResponse = {
  data: {
    instance: string
  }
}

const RELOAD_INTERVAL = 10000

const { t } = useI18n()
const queryClient = useQueryClient()
const uciChangesStore = useUciPendingChangesStore()

const {
  data: servers,
  isPending: isPendingServers,
  error: serversError
} = useQuery({
  queryKey: ['ovpnrw', 'instances'],
  queryFn: () => ubusCall<ListInstancesResponse>('ns.ovpnrw', 'list-instances'),
  select: (res) => res.data.details,
  refetchInterval: RELOAD_INTERVAL
})

// the selected tab is stored inside the route, it is the identifier of a server or the history tab
const tabFromRoute = useRouteQuery<string>('tab', '')
const serverIds = computed(() => (servers.value ?? []).map((server) => server.instance))
const selectedTab = computed({
  get: () => resolveSelectedTab(tabFromRoute.value, serverIds.value),
  set: (value: string) => {
    tabFromRoute.value = value
  }
})

// internal identifiers are never shown: each tab is named after the server
const tabs = computed<Tab[]>(() => [
  ...(servers.value ?? []).map((server) => ({
    name: server.instance,
    label: getServerLabel(server, t('standalone.openvpn_rw.new_server'))
  })),
  { name: RW_HISTORY_TAB, label: t('standalone.openvpn_rw.tabs.connections_history') }
])

const isServerSelected = computed(
  () => selectedTab.value !== '' && selectedTab.value !== RW_HISTORY_TAB
)

// server just created, its configuration is opened automatically
const newServer = ref('')

const {
  mutate: addServer,
  isPending: isAddingServer,
  error: addServerError
} = useMutation({
  mutationFn: () => ubusCall<AddInstanceResponse>('ns.ovpnrw', 'add-instance'),
  onSuccess: async (res) => {
    newServer.value = res.data.instance
    await Promise.all([
      uciChangesStore.getChanges(),
      queryClient.invalidateQueries({ queryKey: ['ovpnrw', 'instances'] })
    ])
    selectedTab.value = res.data.instance
  }
})

async function reloadServers() {
  await uciChangesStore.getChanges()
  await queryClient.invalidateQueries({ queryKey: ['ovpnrw', 'instances'] })
}

async function onServerDeleted() {
  await reloadServers()
  // select the first available server
  selectedTab.value = ''
}
</script>

<template>
  <div class="flex flex-col justify-between md:flex-row md:items-center">
    <NeHeading tag="h3" class="mb-7">{{ t('standalone.openvpn_rw.title') }}</NeHeading>
    <NeButton
      v-if="servers && servers.length > 0"
      kind="secondary"
      size="lg"
      class="mb-7 shrink-0"
      :loading="isAddingServer"
      :disabled="isAddingServer"
      @click="addServer()"
    >
      <template #prefix>
        <FontAwesomeIcon :icon="faPlus" class="h-4 w-4" aria-hidden="true" />
      </template>
      {{ t('standalone.openvpn_rw.add_server') }}
    </NeButton>
  </div>
  <NeInlineNotification
    v-if="serversError"
    :title="t('error.cannot_retrieve_rw_server')"
    :description="t(getAxiosErrorMessage(serversError))"
    class="mb-6"
    kind="error"
  />
  <NeInlineNotification
    v-if="addServerError"
    :title="t('error.cannot_initialize_server')"
    :description="t(getAxiosErrorMessage(addServerError))"
    class="mb-6"
    kind="error"
  />
  <NeSkeleton v-if="isPendingServers" size="lg" :lines="10" />
  <div v-else-if="servers" class="flex flex-col gap-y-6">
    <p class="max-w-2xl text-sm font-normal text-gray-500 dark:text-gray-400">
      {{ t('standalone.openvpn_rw.roadwarrior_server_description') }}
    </p>
    <NeEmptyState
      v-if="servers.length === 0"
      :title="t('standalone.openvpn_rw.no_openvpn_rw_server_found')"
      :icon="faGlobe"
    >
      <NeButton
        kind="primary"
        :loading="isAddingServer"
        :disabled="isAddingServer"
        @click="addServer()"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faWrench" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ t('standalone.openvpn_rw.create_server') }}
      </NeButton>
    </NeEmptyState>
    <template v-else>
      <NeTabs
        :selected="selectedTab"
        :sr-select-tab-label="t('ne_tabs.select_a_tab')"
        :sr-tabs-label="t('ne_tabs.tabs')"
        :tabs="tabs"
        class="mb-2"
        @select-tab="selectedTab = $event"
      />
      <RWServerTab
        v-if="isServerSelected"
        :key="selectedTab"
        :instance="selectedTab"
        :open-configure-on-mount="selectedTab === newServer"
        @configure-opened="newServer = ''"
        @server-changed="reloadServers"
        @server-deleted="onServerDeleted"
      />
      <ConnectionsHistory v-else :servers="servers" />
    </template>
  </div>
</template>
