<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" setup>
import {
  NeBadgeV2,
  NeCard,
  NeInlineNotification,
  NeHeading,
  NeEmptyState,
  NeButton,
  NeDropdown,
  type NeDropdownItem,
  NeTable,
  NeTableHeadCell,
  NeTableHead,
  NeTableBody,
  useItemPagination,
  NePaginator,
  type NeBadgeV2Kind
} from '@nethesis/vue-components'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCircleCheck,
  faCirclePlus,
  faCircleXmark,
  faGlobe,
  faKey,
  faPenToSquare,
  faShieldHalved,
  faTrash,
  faUserGroup,
  faUserLock,
  type IconDefinition
} from '@fortawesome/free-solid-svg-icons'
import type {
  Peer,
  Tunnel,
  WireguardAuthMode
} from '@/views/standalone/vpn/WireguardTunnelView.vue'
import PeerTableRow from '@/components/standalone/wireguard/PeerTableRow.vue'

const { t } = useI18n()

const { instance, filter } = defineProps<{
  instance: Tunnel
  filter: string
}>()

const emit = defineEmits<{
  edit: [item: Tunnel]
  delete: [item: Tunnel]
  'add-peer': [item: Tunnel]
  'edit-peer': [instance: Tunnel, peer: Peer]
  'delete-peer': [peer: Peer]
  'logout-peer': [peer: Peer]
  'download-peer-otp': [peer: Peer]
  'clear-peer-alerts': [peer: Peer]
  'regenerate-peer-keys': [peer: Peer]
  'allow-device-enrollment': [peer: Peer]
  'revoke-device': [peer: Peer]
  'clear-filter': []
}>()

// login with user credentials, see auth_mode
const loginRequired = computed(() => instance.auth_mode != undefined && instance.auth_mode != 'key')
const otpRequired = computed(() => instance.auth_mode == 'key_password_otp')
const deviceBinding = computed(() => loginRequired.value && instance.device_binding == true)

// how the peers get in, next to the name: missing on firewalls without the login feature
const AUTH_BADGES: Record<WireguardAuthMode, { kind: NeBadgeV2Kind; icon: IconDefinition }> = {
  key: { kind: 'gray', icon: faKey },
  key_password: { kind: 'blue', icon: faUserLock },
  key_password_otp: { kind: 'indigo', icon: faShieldHalved }
}
const authBadge = computed(() =>
  instance.auth_mode != undefined ? AUTH_BADGES[instance.auth_mode] : undefined
)

// the settings of the server, in a grid under its name
const details = computed<{ label: string; value: string | number }[]>(() => {
  const items: { label: string; value: string | number }[] = [
    { label: t('standalone.wireguard_tunnel.vpn_network'), value: instance.network },
    { label: t('standalone.wireguard_tunnel.port'), value: instance.listen_port },
    { label: t('standalone.wireguard_tunnel.public_endpoint'), value: instance.public_endpoint }
  ]
  if (instance.fallback_endpoints && instance.fallback_endpoints.length > 0) {
    items.push({
      label: t('standalone.wireguard_tunnel.fallback_endpoints'),
      value: instance.fallback_endpoints.join(', ')
    })
  }
  if (instance.mtu != 0) {
    items.push({ label: t('standalone.wireguard_tunnel.mtu'), value: instance.mtu })
  }
  if (instance.dns.length > 0) {
    items.push({ label: t('standalone.wireguard_tunnel.dns'), value: instance.dns.join(', ') })
  }
  if (loginRequired.value && instance.login_url) {
    items.push({ label: t('standalone.wireguard_tunnel.login_page'), value: instance.login_url })
  }
  if (deviceBinding.value) {
    items.push({
      label: t('standalone.wireguard_tunnel.device_binding'),
      value: instance.machine_id
        ? t('standalone.wireguard_tunnel.device_binding_with_machine_id')
        : t('standalone.wireguard_tunnel.device_binding_on')
    })
  }
  return items
})

// the columns of the peers that are often empty, shown only when a peer of the server has a value
const showServerNetworks = computed(() =>
  instance.peers.some((peer) => peer.route_all_traffic || peer.local_networks.length > 0)
)
const showPeerNetworks = computed(() =>
  instance.peers.some((peer) => peer.remote_networks.length > 0)
)
const showMtu = computed(() => instance.peers.some((peer) => peer.mtu && peer.mtu > 0))
// a table of up to 6 columns fits from 1280 pixels, a wider one from 1536: cards below
const cardBreakpoint = computed<'xl' | '2xl'>(() => {
  const columns =
    4 +
    [
      loginRequired.value,
      loginRequired.value,
      deviceBinding.value,
      showServerNetworks.value,
      showPeerNetworks.value,
      showMtu.value
    ].filter(Boolean).length
  return columns <= 6 ? 'xl' : '2xl'
})

// one peer per user on a server: for each peer, the other peers of its user, linked before the rule
const sharedWith = computed<Record<string, string[]>>(() => {
  const byUser = new Map<string, Peer[]>()
  for (const peer of instance.peers) {
    if (peer.user) {
      const key = peer.user.toLowerCase()
      byUser.set(key, [...(byUser.get(key) ?? []), peer])
    }
  }
  const result: Record<string, string[]> = {}
  for (const peers of byUser.values()) {
    for (const peer of peers) {
      result[peer.id] = peers.filter((other) => other.id != peer.id).map((other) => other.name)
    }
  }
  return result
})

const tunnelActions: NeDropdownItem[] = [
  {
    id: 'edit',
    label: t('standalone.wireguard_tunnel.edit_tunnel'),
    icon: faPenToSquare,
    action: () => emit('edit', instance)
  },
  {
    id: 'divider1'
  },
  {
    id: 'delete',
    label: t('standalone.wireguard_tunnel.delete_tunnel'),
    icon: faTrash,
    danger: true,
    action: () => emit('delete', instance)
  }
]

const filteredPeers = computed<Peer[]>(() => {
  if (filter.length == 0) {
    return instance.peers
  } else {
    const lowerFilter = filter.toLowerCase()
    return instance.peers.filter((peer) => {
      return (
        peer.name.toLowerCase().includes(lowerFilter) ||
        peer.reserved_ip.toLowerCase().includes(lowerFilter) ||
        (peer.user ?? '').toLowerCase().includes(lowerFilter) ||
        peer.remote_networks.some((network) => network.toLowerCase().includes(lowerFilter)) ||
        peer.local_networks.some((network) => network.toLowerCase().includes(lowerFilter))
      )
    })
  }
})

const pageSize = ref(10)
const { currentPage, paginatedItems } = useItemPagination(() => filteredPeers.value, {
  itemsPerPage: pageSize
})

function openPeerDrawer() {
  emit('add-peer', instance)
}
</script>

<template>
  <NeCard>
    <div class="space-y-6">
      <!-- on a phone the buttons go under the name and the badges -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <NeHeading tag="h4">{{ instance.name }}</NeHeading>
          <NeBadgeV2 v-if="instance.enabled" kind="green" size="xs">
            <FontAwesomeIcon :icon="faCircleCheck" class="size-4" />
            {{ t('common.enabled') }}
          </NeBadgeV2>
          <NeBadgeV2 v-else kind="gray" size="xs">
            <FontAwesomeIcon :icon="faCircleXmark" class="size-4" />
            {{ t('common.disabled') }}
          </NeBadgeV2>
          <NeBadgeV2 v-if="authBadge" :kind="authBadge.kind" size="xs">
            <FontAwesomeIcon :icon="authBadge.icon" class="size-4" />
            {{ t(`standalone.wireguard_tunnel.auth_mode_${instance.auth_mode}`) }}
          </NeBadgeV2>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <NeButton
            v-if="instance.peers.length > 0"
            kind="primary"
            size="lg"
            @click="openPeerDrawer"
          >
            <template #prefix>
              <FontAwesomeIcon :icon="faCirclePlus" aria-hidden="true" class="h-4 w-4" />
            </template>
            {{ t('standalone.wireguard_tunnel.add_peer') }}
          </NeButton>
          <NeDropdown :items="tunnelActions" :align-to-right="true" />
        </div>
      </div>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="item in details" :key="item.label">
          <dt class="font-semibold">{{ item.label }}</dt>
          <dd class="mt-1 break-words text-gray-600 dark:text-gray-300">{{ item.value }}</dd>
        </div>
      </dl>
      <NeInlineNotification
        v-if="loginRequired && instance.auth_blocked"
        kind="error"
        :title="t('standalone.wireguard_tunnel.login_blocked')"
        :description="t('standalone.wireguard_tunnel.login_blocked_description')"
      />
      <NeInlineNotification
        v-else-if="loginRequired && instance.enabled && instance.auth_enforced === false"
        kind="warning"
        :title="t('standalone.wireguard_tunnel.login_not_enforced')"
        :description="t('standalone.wireguard_tunnel.login_not_enforced_description')"
      />
      <NeEmptyState
        v-if="instance.peers.length <= 0"
        :title="t('standalone.wireguard_tunnel.no_peer_configured')"
        :icon="faUserGroup"
      >
        <NeButton kind="primary" @click="openPeerDrawer">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" aria-hidden="true" class="h-4 w-4" />
          </template>
          {{ t('standalone.wireguard_tunnel.add_peer') }}
        </NeButton>
      </NeEmptyState>
      <NeEmptyState
        v-else-if="filteredPeers.length <= 0"
        :title="t('standalone.wireguard_tunnel.no_peer_found')"
        :description="t('common.try_changing_search_filter')"
        :icon="faGlobe"
      >
        <NeButton kind="tertiary" @click="emit('clear-filter')">
          {{ t('common.clear_filter') }}
        </NeButton>
      </NeEmptyState>
      <NeTable
        v-else
        :aria-label="t('standalone.wireguard_tunnel.peers')"
        :card-breakpoint="cardBreakpoint"
      >
        <NeTableHead>
          <NeTableHeadCell>
            {{ t('standalone.wireguard_tunnel.name') }}
          </NeTableHeadCell>
          <NeTableHeadCell v-if="loginRequired">
            {{ t('standalone.wireguard_tunnel.user') }}
          </NeTableHeadCell>
          <NeTableHeadCell>
            {{ t('standalone.wireguard_tunnel.reserved_ip') }}
          </NeTableHeadCell>
          <NeTableHeadCell v-if="showServerNetworks">
            {{ t('standalone.wireguard_tunnel.server_networks') }}
          </NeTableHeadCell>
          <NeTableHeadCell v-if="showPeerNetworks">
            {{ t('standalone.wireguard_tunnel.peer_networks') }}
          </NeTableHeadCell>
          <NeTableHeadCell v-if="showMtu">
            {{ t('standalone.wireguard_tunnel.mtu') }}
          </NeTableHeadCell>
          <NeTableHeadCell>
            {{ t('standalone.wireguard_tunnel.connection') }}
          </NeTableHeadCell>
          <NeTableHeadCell v-if="loginRequired">
            {{ t('standalone.wireguard_tunnel.login') }}
          </NeTableHeadCell>
          <NeTableHeadCell v-if="deviceBinding">
            {{ t('standalone.wireguard_tunnel.device') }}
          </NeTableHeadCell>
          <NeTableHeadCell>
            <!-- no header for actions -->
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <PeerTableRow
            v-for="peer in paginatedItems"
            :key="peer.id"
            :peer="peer"
            :login-required="loginRequired"
            :otp-required="otpRequired"
            :device-binding="deviceBinding"
            :show-server-networks="showServerNetworks"
            :show-peer-networks="showPeerNetworks"
            :show-mtu="showMtu"
            :shared-with="loginRequired ? (sharedWith[peer.id] ?? []) : []"
            @edit="(item) => emit('edit-peer', instance, item)"
            @delete="(item) => emit('delete-peer', item)"
            @logout="(item) => emit('logout-peer', item)"
            @download-otp="(item) => emit('download-peer-otp', item)"
            @clear-alerts="(item) => emit('clear-peer-alerts', item)"
            @regenerate-keys="(item) => emit('regenerate-peer-keys', item)"
            @allow-device-enrollment="(item) => emit('allow-device-enrollment', item)"
            @revoke-device="(item) => emit('revoke-device', item)"
          />
        </NeTableBody>
        <template #paginator>
          <NePaginator
            :current-page="currentPage"
            :total-rows="filteredPeers.length"
            :page-size="pageSize"
            :nav-pagination-label="t('ne_table.pagination')"
            :next-label="t('ne_table.go_to_next_page')"
            :previous-label="t('ne_table.go_to_previous_page')"
            :range-of-total-label="t('ne_table.of')"
            :page-size-label="t('ne_table.show')"
            @select-page="
              (page: number) => {
                currentPage = page
              }
            "
            @select-page-size="
              (size: number) => {
                pageSize = size
              }
            "
          />
        </template>
      </NeTable>
    </div>
  </NeCard>
</template>
