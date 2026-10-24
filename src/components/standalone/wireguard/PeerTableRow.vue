<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" setup>
import type { Peer } from '@/views/standalone/vpn/WireguardTunnelView.vue'
import {
  humanDistanceToNowLoc,
  NeButton,
  NeDropdown,
  type NeDropdownItem,
  NeTableCell,
  NeTableRow,
  NeTooltip
} from '@nethesis/vue-components'
import {
  faCircleArrowDown,
  faCircleCheck,
  faCircleXmark,
  faKey,
  faPenToSquare,
  faQrcode,
  faRightFromBracket,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useI18n } from 'vue-i18n'
import { useQRCode } from '@vueuse/integrations/useQRCode'
import { computed } from 'vue'

const { t } = useI18n()

const {
  peer,
  loginRequired = false,
  otpRequired = false
} = defineProps<{
  peer: Peer
  loginRequired?: boolean
  otpRequired?: boolean
}>()

const emit = defineEmits<{
  edit: [item: Peer]
  delete: [item: Peer]
  logout: [item: Peer]
  'download-otp': [item: Peer]
}>()

const qrCode = useQRCode(peer.config)

function downloadConfig() {
  const blob = new Blob([peer.config], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${peer.name}.conf`
  link.click()
  URL.revokeObjectURL(url)
}

function downloadQrCode() {
  const link = document.createElement('a')
  link.href = qrCode.value
  link.download = `${peer.name}.png`
  link.click()
  URL.revokeObjectURL(qrCode.value)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

const peerActions = computed<NeDropdownItem[]>(() => {
  const actions: NeDropdownItem[] = [
    {
      id: 'download-config',
      label: t('standalone.wireguard_tunnel.download_configuration'),
      icon: faCircleArrowDown,
      action: () => downloadConfig()
    },
    {
      id: 'download-qr',
      label: t('standalone.wireguard_tunnel.download_qr_code'),
      icon: faQrcode,
      action: () => downloadQrCode()
    }
  ]
  if (otpRequired) {
    actions.push({
      id: 'download-otp',
      label: t('standalone.wireguard_tunnel.download_otp_qr_code'),
      icon: faKey,
      disabled: !peer.user,
      action: () => emit('download-otp', peer)
    })
  }
  if (loginRequired) {
    actions.push({
      id: 'logout',
      label: t('standalone.wireguard_tunnel.log_out_peer'),
      icon: faRightFromBracket,
      disabled: !peer.authenticated,
      action: () => emit('logout', peer)
    })
  }
  actions.push(
    {
      id: 'divider1'
    },
    {
      id: 'delete',
      label: t('standalone.wireguard_tunnel.delete_peer'),
      icon: faTrash,
      danger: true,
      action: () => emit('delete', peer)
    }
  )
  return actions
})
</script>

<template>
  <NeTableRow>
    <NeTableCell :data-label="t('standalone.wireguard_tunnel.name')">
      {{ peer.name }}
    </NeTableCell>
    <NeTableCell v-if="loginRequired" :data-label="t('standalone.wireguard_tunnel.user')">
      <template v-if="peer.user">{{ peer.user }}</template>
      <template v-else> - </template>
    </NeTableCell>
    <NeTableCell :data-label="t('standalone.wireguard_tunnel.reserved_ip')">
      {{ peer.reserved_ip }}
    </NeTableCell>
    <NeTableCell :data-label="t('standalone.wireguard_tunnel.server_networks')">
      <template v-if="peer.route_all_traffic">
        {{ t('standalone.wireguard_tunnel.all_traffic') }}
      </template>
      <template v-else-if="peer.local_networks.length > 0">
        {{ peer.local_networks.join(', ') }}
      </template>
      <template v-else> - </template>
    </NeTableCell>
    <NeTableCell :data-label="t('standalone.wireguard_tunnel.peer_networks')">
      <template v-if="peer.remote_networks.length > 0">
        {{ peer.remote_networks.join(', ') }}
      </template>
      <template v-else> - </template>
    </NeTableCell>
    <NeTableCell :data-label="t('standalone.wireguard_tunnel.mtu')">
      <template v-if="peer.mtu && peer.mtu > 0">
        {{ peer.mtu }}
      </template>
      <template v-else> - </template>
    </NeTableCell>
    <NeTableCell :data-label="t('standalone.wireguard_tunnel.status')">
      <div class="flex items-center gap-1">
        <template v-if="peer.enabled">
          <FontAwesomeIcon
            :icon="faCircleCheck"
            class="size-4 text-green-700 dark:text-green-500"
          />
          {{ t('common.enabled') }}
        </template>
        <template v-else>
          <FontAwesomeIcon :icon="faCircleXmark" class="size-4 text-red-700 dark:text-red-500" />
          {{ t('common.disabled') }}
        </template>
      </div>
    </NeTableCell>
    <NeTableCell :data-label="t('standalone.wireguard_tunnel.connection')">
      <div class="flex items-center gap-2">
        <template v-if="peer.active">
          <FontAwesomeIcon
            :icon="faCircleCheck"
            class="size-4 text-green-700 dark:text-green-500"
          />
          {{ t('common.connected') }}
        </template>
        <template v-else>
          <FontAwesomeIcon :icon="faCircleXmark" class="size-4 text-red-700 dark:text-red-500" />
          {{ t('common.not_connected') }}
        </template>
        <template v-if="peer.latest_handshake != undefined">
          <NeTooltip>
            <template #content>
              {{
                t('standalone.wireguard_tunnel.latest_handshake', {
                  time: humanDistanceToNowLoc(new Date(peer.latest_handshake))
                })
              }}
            </template>
          </NeTooltip>
        </template>
      </div>
    </NeTableCell>
    <NeTableCell v-if="loginRequired" :data-label="t('standalone.wireguard_tunnel.login')">
      <div class="flex items-center gap-2">
        <template v-if="peer.authenticated && peer.auth_expires">
          <FontAwesomeIcon
            :icon="faCircleCheck"
            class="size-4 text-green-700 dark:text-green-500"
          />
          {{
            t('standalone.wireguard_tunnel.logged_in_until', {
              time: formatTime(peer.auth_expires)
            })
          }}
        </template>
        <template v-else>
          <FontAwesomeIcon :icon="faCircleXmark" class="size-4 text-gray-500 dark:text-gray-400" />
          {{ t('standalone.wireguard_tunnel.not_logged_in') }}
        </template>
      </div>
    </NeTableCell>
    <NeTableCell :data-label="t('common.actions')">
      <div class="flex justify-end gap-2">
        <NeButton kind="tertiary" @click="$emit('edit', peer)">
          <template #prefix>
            <FontAwesomeIcon :icon="faPenToSquare" aria-hidden="true" class="size-4" />
          </template>
          {{ t('common.edit') }}
        </NeButton>
        <NeDropdown :items="peerActions" :align-to-right="true" />
      </div>
    </NeTableCell>
  </NeTableRow>
</template>
