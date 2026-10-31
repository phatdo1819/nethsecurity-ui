<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  NeTable,
  NeTableHead,
  NeTableHeadCell,
  NeTableBody,
  NeTableRow,
  NeTableCell,
  NePaginator,
  NeBadgeV2,
  formatDateLoc,
  byteFormat1024,
  NeSortDropdown,
  NeEmptyState,
  NeButton
} from '@nethesis/vue-components'
import type { WireguardConnection } from './WireguardConnectionsHistory.vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import type { SortEvent } from '@nethesis/vue-components'
import { faArrowDown, faArrowUp, faCircleCheck, faTable } from '@fortawesome/free-solid-svg-icons'

const { t } = useI18n()

const props = defineProps<{
  connections: WireguardConnection[]
  serverNames: Record<string, string>
  currentPage: number
  totalRows: number
  pageSize: number
  sortKey: string
  sortDescending: boolean
}>()

const emit = defineEmits<{
  (e: 'select-page', page: number): void
  (e: 'select-page-size', size: number): void
  (e: 'sort', payload: { key: string; descending: boolean }): void
  (e: 'clear-filters'): void
}>()

function onSort(payload: SortEvent) {
  emit('sort', { key: payload.key, descending: payload.descending })
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${pad(hours)}h ${pad(minutes)}m ${pad(secs)}s`
}

// the date and the time on two lines
function formatDay(seconds: number): string {
  return formatDateLoc(new Date(seconds * 1000), 'PP')
}

function formatTime(seconds: number): string {
  return formatDateLoc(new Date(seconds * 1000), 'pp')
}

// the user under the peer, unless the peer is named after it
function showUser(item: WireguardConnection): boolean {
  return !!item.user && item.user.toLowerCase() != item.account.toLowerCase()
}

const columns: { key: string; label: string }[] = [
  { key: 'account', label: t('standalone.wireguard_tunnel.history.peer') },
  { key: 'instance', label: t('standalone.wireguard_tunnel.history.server') },
  { key: 'startTime', label: t('standalone.wireguard_tunnel.history.start_time') },
  { key: 'endTime', label: t('standalone.wireguard_tunnel.history.end_time') },
  { key: 'duration', label: t('standalone.wireguard_tunnel.history.duration') },
  { key: 'virtualIpAddress', label: t('standalone.wireguard_tunnel.history.virtual_ip_address') },
  { key: 'remoteIpAddress', label: t('standalone.wireguard_tunnel.history.remote_ip_address') }
]
</script>

<template>
  <NeSortDropdown
    v-if="props.connections.length > 0"
    :sort-key="props.sortKey"
    :sort-descending="props.sortDescending"
    :label="t('sort.sort')"
    :options="[
      ...columns.map((column) => ({ id: column.key, label: column.label })),
      { id: 'bytesReceived', label: t('standalone.wireguard_tunnel.history.bytes_received') },
      { id: 'bytesSent', label: t('standalone.wireguard_tunnel.history.bytes_sent') }
    ]"
    :open-menu-aria-label="t('ne_dropdown.open_menu')"
    :sort-by-label="t('sort.sort_by')"
    :sort-direction-label="t('sort.direction')"
    :ascending-label="t('sort.ascending')"
    :descending-label="t('sort.descending')"
    class="xl:hidden"
    @sort="onSort"
  />
  <NeTable
    :sort-key="props.sortKey"
    :sort-descending="props.sortDescending"
    :aria-label="t('standalone.wireguard_tunnel.history.connections_table')"
    card-breakpoint="xl"
    :skeleton-columns="5"
    :skeleton-rows="5"
  >
    <NeTableHead>
      <NeTableHeadCell
        v-for="column in columns"
        :key="column.key"
        :sortable="props.connections.length > 0"
        :column-key="column.key"
        @sort="onSort"
        >{{ column.label }}</NeTableHeadCell
      >
      <NeTableHeadCell>{{
        t('standalone.wireguard_tunnel.history.received_sent')
      }}</NeTableHeadCell>
    </NeTableHead>
    <NeTableBody v-if="props.connections.length > 0">
      <NeTableRow v-for="item in props.connections" :key="`${item.peer}-${item.startTime}`">
        <NeTableCell :data-label="t('standalone.wireguard_tunnel.history.peer')">
          <!-- one element per cell: in the cards each element of a cell takes a column -->
          <div>
            <div>{{ item.account || '-' }}</div>
            <div v-if="showUser(item)" class="text-gray-500 dark:text-gray-400">
              {{ item.user }}
            </div>
          </div>
        </NeTableCell>
        <NeTableCell :data-label="t('standalone.wireguard_tunnel.history.server')">
          {{ props.serverNames[item.instance] ?? item.instance }}
        </NeTableCell>
        <NeTableCell :data-label="t('standalone.wireguard_tunnel.history.start_time')">
          <div class="whitespace-nowrap">
            <div>{{ formatDay(item.startTime) }}</div>
            <div class="text-gray-500 dark:text-gray-400">{{ formatTime(item.startTime) }}</div>
          </div>
        </NeTableCell>
        <NeTableCell :data-label="t('standalone.wireguard_tunnel.history.end_time')">
          <NeBadgeV2 v-if="item.connected" kind="green" size="xs">
            <FontAwesomeIcon :icon="faCircleCheck" class="size-4" aria-hidden="true" />
            {{ t('standalone.wireguard_tunnel.history.connected') }}
          </NeBadgeV2>
          <div v-else-if="item.endTime" class="whitespace-nowrap">
            <div>{{ formatDay(item.endTime) }}</div>
            <div class="text-gray-500 dark:text-gray-400">{{ formatTime(item.endTime) }}</div>
          </div>
          <template v-else>-</template>
        </NeTableCell>
        <NeTableCell :data-label="t('standalone.wireguard_tunnel.history.duration')">
          <span class="whitespace-nowrap">{{ formatDuration(item.duration) }}</span>
        </NeTableCell>
        <NeTableCell :data-label="t('standalone.wireguard_tunnel.history.virtual_ip_address')">
          {{ item.virtualIpAddress || '-' }}
        </NeTableCell>
        <NeTableCell :data-label="t('standalone.wireguard_tunnel.history.remote_ip_address')">
          {{ item.remoteIpAddress || '-' }}
        </NeTableCell>
        <NeTableCell :data-label="t('standalone.wireguard_tunnel.history.received_sent')">
          <div class="whitespace-nowrap">
            <div class="flex items-center gap-2">
              <FontAwesomeIcon
                :icon="faArrowDown"
                class="size-3 text-gray-500 dark:text-gray-400"
                :aria-label="t('standalone.wireguard_tunnel.history.bytes_received')"
              />
              {{ byteFormat1024(item.bytesReceived) }}
            </div>
            <div class="flex items-center gap-2">
              <FontAwesomeIcon
                :icon="faArrowUp"
                class="size-3 text-gray-500 dark:text-gray-400"
                :aria-label="t('standalone.wireguard_tunnel.history.bytes_sent')"
              />
              {{ byteFormat1024(item.bytesSent) }}
            </div>
          </div>
        </NeTableCell>
      </NeTableRow>
    </NeTableBody>
    <NeTableBody v-else>
      <NeTableRow>
        <NeTableCell colspan="10">
          <NeEmptyState
            class="bg-white dark:bg-gray-950"
            :description="t('standalone.wireguard_tunnel.history.no_connections_found_description')"
            :icon="faTable"
            :title="t('standalone.wireguard_tunnel.history.no_connections_found')"
          >
            <NeButton @click="emit('clear-filters')">
              {{ t('common.clear_filters') }}
            </NeButton>
          </NeEmptyState>
        </NeTableCell>
      </NeTableRow>
    </NeTableBody>
    <template #paginator>
      <NePaginator
        :current-page="currentPage"
        :total-rows="totalRows"
        :page-size="pageSize"
        :nav-pagination-label="t('ne_table.pagination')"
        :next-label="t('ne_table.go_to_next_page')"
        :previous-label="t('ne_table.go_to_previous_page')"
        :range-of-total-label="t('ne_table.of')"
        :page-size-label="t('ne_table.show')"
        @select-page="(page: number) => emit('select-page', page)"
        @select-page-size="(size: number) => emit('select-page-size', size)"
      />
    </template>
  </NeTable>
</template>
