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
  NePaginator
} from '@nethesis/vue-components'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCircleCheck,
  faCirclePlus,
  faCircleXmark,
  faGlobe,
  faPenToSquare,
  faTrash,
  faUserGroup
} from '@fortawesome/free-solid-svg-icons'
import type { Peer, Tunnel } from '@/views/standalone/vpn/WireguardTunnelView.vue'
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
  'clear-filter': []
}>()

// login with user credentials, see auth_mode
const loginRequired = computed(() => instance.auth_mode != undefined && instance.auth_mode != 'key')
const otpRequired = computed(() => instance.auth_mode == 'key_password_otp')

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
      <div class="flex flex-wrap gap-8">
        <div class="mr-auto space-y-4">
          <div class="flex items-center gap-8">
            <NeHeading tag="h4">{{ instance.name }}</NeHeading>
            <NeBadgeV2 v-if="instance.enabled" kind="green" size="xs">
              <FontAwesomeIcon :icon="faCircleCheck" class="size-4" />
              {{ t('common.enabled') }}
            </NeBadgeV2>
            <NeBadgeV2 v-else kind="gray" size="xs">
              <FontAwesomeIcon :icon="faCircleXmark" class="size-4" />
              {{ t('common.disabled') }}
            </NeBadgeV2>
          </div>
          <div class="flex flex-wrap gap-x-8 gap-y-2">
            <span>
              <span class="font-bold"> {{ t('standalone.wireguard_tunnel.vpn_network') }}: </span>
              {{ instance.network }}
            </span>
            <span>
              <span class="font-bold"> {{ t('standalone.wireguard_tunnel.port') }}: </span>
              {{ instance.listen_port }}
            </span>
            <span>
              <span class="font-bold">
                {{ t('standalone.wireguard_tunnel.public_endpoint') }}:
              </span>
              {{ instance.public_endpoint }}
            </span>
            <span v-if="instance.mtu != 0">
              <span class="font-bold"> {{ t('standalone.wireguard_tunnel.mtu') }}: </span>
              {{ instance.mtu }}
            </span>
            <span v-if="instance.dns.length > 0">
              <span class="font-bold"> {{ t('standalone.wireguard_tunnel.dns') }}: </span>
              {{ instance.dns.join(', ') }}
            </span>
            <span v-if="loginRequired">
              <span class="font-bold"> {{ t('standalone.wireguard_tunnel.login') }}: </span>
              {{ t(`standalone.wireguard_tunnel.auth_mode_${instance.auth_mode}`) }}
            </span>
            <span v-if="loginRequired && instance.login_url">
              <span class="font-bold"> {{ t('standalone.wireguard_tunnel.login_page') }}: </span>
              {{ instance.login_url }}
            </span>
          </div>
        </div>
        <div class="flex items-start gap-2">
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
      <NeInlineNotification
        v-if="loginRequired && instance.enabled && instance.auth_enforced === false"
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
      <NeTable v-else :aria-label="t('standalone.wireguard_tunnel.peers')" card-breakpoint="2xl">
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
          <NeTableHeadCell>
            {{ t('standalone.wireguard_tunnel.server_networks') }}
          </NeTableHeadCell>
          <NeTableHeadCell>
            {{ t('standalone.wireguard_tunnel.peer_networks') }}
          </NeTableHeadCell>
          <NeTableHeadCell>
            {{ t('standalone.wireguard_tunnel.mtu') }}
          </NeTableHeadCell>
          <NeTableHeadCell>
            {{ t('standalone.wireguard_tunnel.status') }}
          </NeTableHeadCell>
          <NeTableHeadCell>
            {{ t('standalone.wireguard_tunnel.connection') }}
          </NeTableHeadCell>
          <NeTableHeadCell v-if="loginRequired">
            {{ t('standalone.wireguard_tunnel.login') }}
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
            @edit="(item) => emit('edit-peer', instance, item)"
            @delete="(item) => emit('delete-peer', item)"
            @logout="(item) => emit('logout-peer', item)"
            @download-otp="(item) => emit('download-peer-otp', item)"
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
