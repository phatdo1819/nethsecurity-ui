<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ubusCall } from '@/lib/standalone/ubus'
import WireguardConnectionsTable from './WireguardConnectionsTable.vue'
import { downloadFile, deleteFile } from '@/lib/standalone/fileUpload'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  NeInlineNotification,
  NeButton,
  NeSkeleton,
  NeEmptyState,
  NeTextInput,
  NeDropdownFilter,
  type FilterOption
} from '@nethesis/vue-components'
import { getAxiosErrorMessage } from '@nethesis/vue-components'
import { ref, computed, watch } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { useRouteQuery } from '@vueuse/router'
import { refDebounced } from '@vueuse/core'
import { faClockRotateLeft } from '@fortawesome/free-solid-svg-icons'

const { t } = useI18n()

// a connection of a peer of a server, recorded from its handshakes, see ns.wireguard connection-history
export type WireguardConnection = {
  instance: string
  peer: string
  account: string
  user: string
  virtualIpAddress: string
  remoteIpAddress: string
  startTime: number
  // null while connected
  endTime: number | null
  duration: number
  connected: boolean
  bytesReceived: number
  bytesSent: number
}

type ConnectionHistoryResponse = {
  data: {
    connections: WireguardConnection[]
    current_page: number
    last_page: number
    per_page: number
    results: number
    total: number
    filters: {
      accounts: string[]
      instances: string[]
    }
    server_names: Record<string, string>
  }
}

type RangeFilterOption = 'all' | 'last_3_months' | 'last_month' | 'last_week' | 'today'

const timeRangeFilterOptions: FilterOption[] = [
  { id: 'today', label: t('standalone.wireguard_tunnel.history.today') },
  { id: 'last_week', label: t('standalone.wireguard_tunnel.history.last_week') },
  { id: 'last_month', label: t('standalone.wireguard_tunnel.history.last_month') },
  { id: 'last_3_months', label: t('standalone.wireguard_tunnel.history.last_3_months') },
  { id: 'all', label: t('standalone.wireguard_tunnel.history.all') }
]

// route-persisted filters
const textFilter = useRouteQuery('q', '')
const textFilterDebounced = refDebounced(textFilter, 500)

const timeRangeFilter = useRouteQuery<string, RangeFilterOption[]>('time_range', 'all', {
  transform: {
    get: (val) => (val ? ([val] as RangeFilterOption[]) : ['all']),
    set: (val) => val[0] ?? 'all'
  }
})

const listTransform = {
  get: (val: string) => (val ? val.split(',') : []),
  set: (val: string[]) => val.join(',')
}
const accountsFilter = useRouteQuery<string, string[]>('accounts', '', { transform: listTransform })
const serversFilter = useRouteQuery<string, string[]>('servers', '', { transform: listTransform })

const currentPage = ref(1)
const perPage = ref(10)

type SortableKeys =
  | 'account'
  | 'instance'
  | 'startTime'
  | 'endTime'
  | 'duration'
  | 'virtualIpAddress'
  | 'remoteIpAddress'
  | 'bytesReceived'
  | 'bytesSent'
const sortKey = useRouteQuery<SortableKeys>('sort', 'startTime')
const sortDescending = useRouteQuery<string, boolean>('descending', 'true', {
  transform: {
    get: (val) => val == 'true',
    set: (val) => val.toString()
  }
})

// back to the first page when the filters change
watch([textFilterDebounced, timeRangeFilter, accountsFilter, serversFilter, perPage], () => {
  if (currentPage.value !== 1) {
    currentPage.value = 1
  }
})

const startTime = computed<number | null>(() => {
  const now = new Date()
  const days = { last_week: 7, last_month: 30, last_3_months: 90 }
  const timeRange = timeRangeFilter.value[0]
  if (timeRange === 'today') {
    return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000)
  } else if (timeRange && timeRange in days) {
    const d = new Date(now)
    d.setDate(now.getDate() - days[timeRange as keyof typeof days])
    return Math.floor(d.getTime() / 1000)
  }
  return null
})

const { data, isError, error, isPending, isSuccess } = useQuery({
  queryKey: [
    'wireguard',
    'connection-history',
    textFilterDebounced,
    startTime,
    accountsFilter,
    serversFilter,
    perPage,
    currentPage,
    sortKey,
    sortDescending
  ],
  queryFn: async () =>
    ubusCall<ConnectionHistoryResponse>('ns.wireguard', 'connection-history', {
      instances: serversFilter.value,
      q: textFilterDebounced.value.toLowerCase(),
      ...(startTime.value !== null && { start_time: startTime.value }),
      accounts: accountsFilter.value,
      page: currentPage.value,
      per_page: perPage.value,
      sort_by: sortKey.value,
      desc: sortDescending.value
    }),
  placeholderData: keepPreviousData,
  select: (res) => res.data,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  // the history is recorded every minute
  refetchInterval: 60000,
  retry: false
})

watch(data, (newData) => {
  if (newData != undefined && currentPage.value > newData.last_page) {
    currentPage.value = newData.last_page
  }
})

function serverName(instance: string): string {
  return data.value?.server_names[instance] ?? instance
}

const accountFilterOptions = computed<FilterOption[]>(
  () => data.value?.filters.accounts.map((account) => ({ id: account, label: account })) ?? []
)

const serverFilterOptions = computed<FilterOption[]>(
  () =>
    data.value?.filters.instances.map((instance) => ({
      id: instance,
      label: serverName(instance)
    })) ?? []
)

function clearFilters() {
  textFilter.value = ''
  timeRangeFilter.value = ['all']
  accountsFilter.value = []
  serversFilter.value = []
}

const downloadError = ref({
  notificationDescription: '',
  notificationDetails: '',
  notificationTitle: ''
})

async function downloadAllHistory() {
  downloadError.value = {
    notificationTitle: '',
    notificationDescription: '',
    notificationDetails: ''
  }
  try {
    const res = await ubusCall('ns.wireguard', 'connection-history-csv', {
      instances: serversFilter.value,
      // the time zone of the browser
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    })
    if (res?.data?.csv_path) {
      const name = res.data.csv_path.replace('/var/run/ns-api-server/downloads/', '')
      const file = await downloadFile(name)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(file)
      link.download = name.replace('.csv', '') + '-' + Date.now().toString() + '.csv'
      link.click()
      await deleteFile(name)
    }
  } catch (exception: unknown) {
    downloadError.value.notificationTitle = t(
      'standalone.wireguard_tunnel.history.cannot_download_history'
    )
    downloadError.value.notificationDescription = t(getAxiosErrorMessage(exception))
    downloadError.value.notificationDetails = String(exception)
  }
}
</script>

<template>
  <div class="flex flex-col gap-y-6">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
      <p class="max-w-2xl text-sm font-normal text-gray-500 dark:text-gray-400">
        {{ t('standalone.wireguard_tunnel.history.description') }}
      </p>
      <div class="shrink-0">
        <NeButton
          v-if="isSuccess && data!.results > 0"
          kind="secondary"
          size="lg"
          @click="downloadAllHistory()"
        >
          <template #prefix>
            <FontAwesomeIcon
              :icon="['fas', 'fa-circle-arrow-down']"
              class="h-4 w-4"
              aria-hidden="true"
            />
          </template>
          {{ t('standalone.wireguard_tunnel.history.download_history') }}
        </NeButton>
      </div>
    </div>
    <div v-if="data?.total !== 0" class="flex flex-wrap items-center gap-4">
      <NeTextInput
        v-model="textFilter"
        class="max-w-xs"
        :is-search="true"
        :placeholder="t('common.filter')"
      />
      <NeDropdownFilter
        v-model="timeRangeFilter"
        kind="radio"
        :label="t('standalone.wireguard_tunnel.history.time_range')"
        :options="timeRangeFilterOptions"
        :clear-search-label="t('ne_dropdown_filter.clear_search')"
        :clear-filter-label="t('ne_dropdown_filter.clear_selection')"
        :open-menu-aria-label="t('ne_dropdown_filter.open_filter')"
        :no-options-label="t('ne_dropdown_filter.no_options')"
        :more-options-hidden-label="t('ne_dropdown_filter.more_options_hidden')"
      />
      <NeDropdownFilter
        v-if="serverFilterOptions.length > 1"
        v-model="serversFilter"
        kind="checkbox"
        :label="t('standalone.wireguard_tunnel.history.servers')"
        :options="serverFilterOptions"
        :clear-search-label="t('ne_dropdown_filter.clear_search')"
        :clear-filter-label="t('ne_dropdown_filter.clear_selection')"
        :open-menu-aria-label="t('ne_dropdown_filter.open_filter')"
        :no-options-label="t('ne_dropdown_filter.no_options')"
        :more-options-hidden-label="t('ne_dropdown_filter.more_options_hidden')"
      />
      <NeDropdownFilter
        v-model="accountsFilter"
        kind="checkbox"
        :label="t('standalone.wireguard_tunnel.history.peers')"
        :options="accountFilterOptions"
        :clear-search-label="t('ne_dropdown_filter.clear_search')"
        :clear-filter-label="t('ne_dropdown_filter.clear_selection')"
        :open-menu-aria-label="t('ne_dropdown_filter.open_filter')"
        :show-options-filter="true"
        :no-options-label="t('ne_dropdown_filter.no_options')"
        :options-filter-placeholder="t('standalone.wireguard_tunnel.history.filter_peers')"
        :more-options-hidden-label="t('ne_dropdown_filter.more_options_hidden')"
      />
      <NeButton kind="tertiary" :disabled="isPending" @click="clearFilters">
        {{ t('standalone.wireguard_tunnel.history.reset_filters') }}
      </NeButton>
    </div>
    <NeInlineNotification
      v-if="downloadError.notificationDescription"
      kind="error"
      :title="downloadError.notificationTitle"
      :description="downloadError.notificationDescription"
    >
      <template v-if="downloadError.notificationDetails" #details>
        {{ downloadError.notificationDetails }}
      </template>
    </NeInlineNotification>
    <NeInlineNotification
      v-if="isError"
      kind="error"
      :title="t('error.cannot_retrieve_wireguard_connection_history')"
      :description="t(getAxiosErrorMessage(error))"
    />
    <NeSkeleton v-if="isPending" :lines="10" size="lg" />
    <WireguardConnectionsTable
      v-if="isSuccess && data!.total > 0"
      :connections="data!.connections"
      :server-names="data!.server_names"
      :current-page="currentPage"
      :total-rows="data!.results"
      :page-size="perPage"
      :sort-key="sortKey"
      :sort-descending="sortDescending"
      @select-page="
        (page: number) => {
          currentPage = page
        }
      "
      @select-page-size="
        (size: number) => {
          perPage = size
        }
      "
      @sort="
        ({ key, descending }: { key: string; descending: boolean }) => {
          sortKey = key as typeof sortKey
          sortDescending = descending
        }
      "
      @clear-filters="clearFilters"
    />
    <NeEmptyState
      v-if="data?.total === 0"
      :title="t('standalone.wireguard_tunnel.history.no_connections')"
      :description="t('standalone.wireguard_tunnel.history.no_connections_description')"
      :icon="faClockRotateLeft"
    />
  </div>
</template>
