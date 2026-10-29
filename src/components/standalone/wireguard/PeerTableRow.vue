<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" setup>
import type { Peer, PeerAlert } from '@/views/standalone/vpn/WireguardTunnelView.vue'
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
  faBan,
  faBroom,
  faCircleArrowDown,
  faCircleCheck,
  faCircleXmark,
  faHourglassHalf,
  faKey,
  faLaptop,
  faLinkSlash,
  faPenToSquare,
  faQrcode,
  faRightFromBracket,
  faRotate,
  faTrash,
  faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useI18n } from 'vue-i18n'
import { useQRCode } from '@vueuse/integrations/useQRCode'
import { computed } from 'vue'

const { t } = useI18n()

const {
  peer,
  loginRequired = false,
  otpRequired = false,
  deviceBinding = false,
  sharedWith = []
} = defineProps<{
  peer: Peer
  loginRequired?: boolean
  otpRequired?: boolean
  deviceBinding?: boolean
  // the other peers of the server with the same user, linked before the rule of one peer per user
  sharedWith?: string[]
}>()

const emit = defineEmits<{
  edit: [item: Peer]
  delete: [item: Peer]
  logout: [item: Peer]
  'download-otp': [item: Peer]
  'clear-alerts': [item: Peer]
  'regenerate-keys': [item: Peer]
  'allow-device-enrollment': [item: Peer]
  'revoke-device': [item: Peer]
}>()

// the device of the peer, on a server with device binding
const deviceState = computed(() => peer.device?.state ?? 'closed')

const deviceTooltip = computed(() => {
  const device = peer.device
  if (deviceState.value == 'waiting') {
    return t('standalone.wireguard_tunnel.device_waiting_tooltip', {
      time: device?.enrollment_until ? formatTime(device.enrollment_until) : '-'
    })
  }
  if (deviceState.value == 'closed' || device == undefined) {
    return t('standalone.wireguard_tunnel.device_closed_tooltip')
  }
  const text = t('standalone.wireguard_tunnel.device_enrolled_tooltip', {
    enrolled: device.enrolled ? formatTime(device.enrolled) : '-',
    from: device.from || t('standalone.wireguard_tunnel.unknown_ip'),
    last_used: device.last_used ? formatTime(device.last_used) : '-',
    kind: device.kind || '-'
  })
  return device.machine_id
    ? `${text} ${t('standalone.wireguard_tunnel.device_enrolled_machine_id')}`
    : text
})

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

// suspected copies of the configuration and lockouts, newest first
const alerts = computed<PeerAlert[]>(() => peer.alerts ?? [])

function describeAlert(alert: PeerAlert) {
  return t(`standalone.wireguard_tunnel.alert_${alert.type}`, {
    time: formatTime(alert.time),
    addresses:
      alert.addresses.length > 0
        ? alert.addresses.join(', ')
        : t('standalone.wireguard_tunnel.unknown_ip')
  })
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
    actions.push(
      {
        id: 'logout',
        label: t('standalone.wireguard_tunnel.log_out_peer'),
        icon: faRightFromBracket,
        disabled: !peer.authenticated,
        action: () => emit('logout', peer)
      },
      {
        id: 'clear-alerts',
        label: t('standalone.wireguard_tunnel.clear_peer_alerts'),
        icon: faBroom,
        disabled: alerts.value.length == 0 && !peer.blocked,
        action: () => emit('clear-alerts', peer)
      }
    )
  }
  if (deviceBinding) {
    actions.push(
      {
        id: 'allow-device-enrollment',
        label: t('standalone.wireguard_tunnel.allow_device_enrollment'),
        icon: faLaptop,
        action: () => emit('allow-device-enrollment', peer)
      },
      {
        id: 'revoke-device',
        label: t('standalone.wireguard_tunnel.revoke_device'),
        icon: faLinkSlash,
        disabled: deviceState.value == 'closed',
        action: () => emit('revoke-device', peer)
      }
    )
  }
  actions.push(
    {
      id: 'regenerate-keys',
      label: t('standalone.wireguard_tunnel.regenerate_peer_keys'),
      icon: faRotate,
      action: () => emit('regenerate-keys', peer)
    },
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
      <NeTooltip
        v-if="peer.user && sharedWith.length > 0"
        trigger-event="mouseenter focus"
        placement="top-start"
      >
        <template #trigger>
          <span class="flex items-center gap-2 text-amber-700 dark:text-amber-500">
            <FontAwesomeIcon :icon="faTriangleExclamation" class="size-4" aria-hidden="true" />
            {{ peer.user }}
          </span>
        </template>
        <template #content>
          {{
            t('standalone.wireguard_tunnel.user_shared_tooltip', { peers: sharedWith.join(', ') })
          }}
        </template>
      </NeTooltip>
      <template v-else-if="peer.user">{{ peer.user }}</template>
      <NeTooltip v-else trigger-event="mouseenter focus" placement="top-start">
        <template #trigger>
          <span class="flex items-center gap-2 text-amber-700 dark:text-amber-500">
            <FontAwesomeIcon :icon="faTriangleExclamation" class="size-4" aria-hidden="true" />
            {{ t('standalone.wireguard_tunnel.no_user') }}
          </span>
        </template>
        <template #content>
          {{ t('standalone.wireguard_tunnel.no_user_tooltip') }}
        </template>
      </NeTooltip>
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
        <template v-if="peer.blocked">
          <FontAwesomeIcon :icon="faBan" class="size-4 text-rose-700 dark:text-rose-500" />
          {{ t('standalone.wireguard_tunnel.blocked') }}
        </template>
        <template v-else-if="peer.authenticated && peer.auth_expires">
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
        <NeTooltip
          v-if="peer.blocked || alerts.length > 0"
          trigger-event="mouseenter focus"
          placement="top-start"
        >
          <template #trigger>
            <FontAwesomeIcon
              :icon="faTriangleExclamation"
              class="size-4 text-amber-700 dark:text-amber-500"
              :aria-label="t('standalone.wireguard_tunnel.peer_warnings')"
            />
          </template>
          <template #content>
            <p v-if="peer.blocked" class="mb-2">
              {{ t('standalone.wireguard_tunnel.blocked_tooltip') }}
            </p>
            <p v-for="alert in alerts.slice(0, 5)" :key="alert.time + alert.type">
              {{ describeAlert(alert) }}
            </p>
          </template>
        </NeTooltip>
      </div>
    </NeTableCell>
    <NeTableCell v-if="deviceBinding" :data-label="t('standalone.wireguard_tunnel.device')">
      <NeTooltip trigger-event="mouseenter focus" placement="top-start">
        <template #trigger>
          <span v-if="deviceState == 'enrolled'" class="flex items-center gap-2">
            <FontAwesomeIcon
              :icon="faLaptop"
              class="size-4 text-green-700 dark:text-green-500"
              aria-hidden="true"
            />
            {{ peer.device?.name || t('standalone.wireguard_tunnel.device_enrolled_unnamed') }}
          </span>
          <span v-else-if="deviceState == 'waiting'" class="flex items-center gap-2">
            <FontAwesomeIcon
              :icon="faHourglassHalf"
              class="size-4 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            {{ t('standalone.wireguard_tunnel.device_waiting') }}
          </span>
          <span v-else class="flex items-center gap-2 text-amber-700 dark:text-amber-500">
            <FontAwesomeIcon :icon="faTriangleExclamation" class="size-4" aria-hidden="true" />
            {{ t('standalone.wireguard_tunnel.device_closed') }}
          </span>
        </template>
        <template #content>
          {{ deviceTooltip }}
        </template>
      </NeTooltip>
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
