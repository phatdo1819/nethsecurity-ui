<script lang="ts" setup>
import {
  NeButton,
  NeCard,
  NeEmptyState,
  NeInlineNotification,
  NeTextInput,
  getAxiosErrorMessage
} from '@nethesis/vue-components'
import { ref } from 'vue'
import { ubusCall } from '@/lib/standalone/ubus.ts'
import { faCirclePlus, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import WireguardTunnelDetailCard from '@/components/standalone/wireguard/WireguardTunnelDetailCard.vue'
import TunnelDrawer from '@/components/standalone/wireguard/TunnelDrawer.vue'
import DeletePeerModal from '@/components/standalone/wireguard/DeletePeerModal.vue'
import DeleteTunnelModal from '@/components/standalone/wireguard/DeleteTunnelModal.vue'
import PeerDrawer from '@/components/standalone/wireguard/PeerDrawer.vue'
import RegeneratePeerKeysModal from '@/components/standalone/wireguard/RegeneratePeerKeysModal.vue'
import type { Peer, Tunnel } from '@/views/standalone/vpn/WireguardTunnelView.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// the page loads the servers, for their tabs: this shows the one of the selected tab
const {
  instance = undefined,
  loading,
  error = undefined,
  refreshSeconds,
  reload,
  refresh
} = defineProps<{
  // undefined when there are no servers
  instance?: Tunnel
  loading: boolean
  error?: Error
  refreshSeconds: number
  // the servers again
  reload: () => Promise<unknown>
  // the servers and the changes to apply again; after the drawer of a server, the one just added is selected
  refresh: (serverSaved?: boolean) => Promise<unknown>
}>()

function fetchData(): Promise<unknown> {
  return reload()
}

function refreshData(): Promise<unknown> {
  return refresh()
}

const showTunnelDrawer = ref(false)
function createdTunnel() {
  refresh(true).finally(() => closeTunnelDrawer())
}

const editingTunnel = ref<Tunnel>()
function editTunnel(instance: Tunnel) {
  editingTunnel.value = instance
  showTunnelDrawer.value = true
}

function closeTunnelDrawer() {
  showTunnelDrawer.value = false
  editingTunnel.value = undefined
}

const deletingTunnel = ref<Tunnel>()
function deleteTunnel(instance: Tunnel) {
  deletingTunnel.value = instance
}
function closeDeleteModal() {
  deletingTunnel.value = undefined
}
function tunnelDeleted() {
  refreshData().then(closeDeleteModal)
}

const showPeerDrawer = ref(false)
const creatingPeerFor = ref<Tunnel>()
const editPeer = ref<Peer>()
function closePeerDrawer() {
  showPeerDrawer.value = false
  creatingPeerFor.value = undefined
  editPeer.value = undefined
}
function addPeerHandler(instance: Tunnel) {
  showPeerDrawer.value = true
  creatingPeerFor.value = instance
}
function addedPeerHandler() {
  refreshData().then(closePeerDrawer)
}
function editPeerHandler(instance: Tunnel, peer: Peer) {
  showPeerDrawer.value = true
  creatingPeerFor.value = instance
  editPeer.value = peer
}
const peerToDelete = ref<Peer>()
function deletePeerHandler(peer: Peer) {
  peerToDelete.value = peer
}
function closeDeletePeerModal() {
  peerToDelete.value = undefined
}
function peerDeleted() {
  refreshData().then(closeDeletePeerModal)
}

// errors of the peer actions that don't open a drawer
const actionError = ref<{ title: string; description: string }>()

function logoutPeer(peer: Peer) {
  actionError.value = undefined
  ubusCall('ns.wireguard', 'logout-peer', { id: peer.id })
    .then(() => fetchData())
    .catch((err) => {
      actionError.value = {
        title: t('standalone.wireguard_tunnel.error_logging_out_peer'),
        description: t(getAxiosErrorMessage(err))
      }
    })
}

function downloadPeerOtp(peer: Peer) {
  actionError.value = undefined
  ubusCall('ns.wireguard', 'download-peer-2fa', { id: peer.id })
    .then((response) => {
      const url = URL.createObjectURL(new Blob([response.data.data], { type: 'image/svg+xml' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${peer.user || peer.name}-otp.svg`
      link.click()
      URL.revokeObjectURL(url)
    })
    .catch((err) => {
      actionError.value = {
        title: t('standalone.wireguard_tunnel.error_downloading_otp_qr_code'),
        description: t(getAxiosErrorMessage(err))
      }
    })
}

function clearPeerAlerts(peer: Peer) {
  actionError.value = undefined
  ubusCall('ns.wireguard', 'clear-peer-alerts', { id: peer.id })
    .then(() => fetchData())
    .catch((err) => {
      actionError.value = {
        title: t('standalone.wireguard_tunnel.error_clearing_peer_alerts'),
        description: t(getAxiosErrorMessage(err))
      }
    })
}

// device binding: these act at once, without applying the changes
function allowDeviceEnrollment(peer: Peer) {
  actionError.value = undefined
  ubusCall('ns.wireguard', 'allow-device-enrollment', { id: peer.id })
    .then(() => fetchData())
    .catch((err) => {
      actionError.value = {
        title: t('standalone.wireguard_tunnel.error_allowing_device_enrollment'),
        description: t(getAxiosErrorMessage(err))
      }
    })
}

function revokeDevice(peer: Peer) {
  actionError.value = undefined
  ubusCall('ns.wireguard', 'revoke-device', { id: peer.id })
    .then(() => fetchData())
    .catch((err) => {
      actionError.value = {
        title: t('standalone.wireguard_tunnel.error_revoking_device'),
        description: t(getAxiosErrorMessage(err))
      }
    })
}

const peerToRegenerate = ref<Peer>()
function peerKeysRegenerated() {
  refreshData().then(() => (peerToRegenerate.value = undefined))
}

// kept from server to server: a name can be looked for on each
const peerFilter = ref('')
</script>

<template>
  <div>
    <NeCard v-if="loading" loading />
    <div v-else class="space-y-6">
      <div class="flex flex-wrap gap-4">
        <p class="mr-auto max-w-2xl text-sm font-normal text-gray-500 dark:text-gray-400">
          {{ t('standalone.wireguard_tunnel.description') }}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('common.data_updated_every_seconds', { seconds: refreshSeconds }) }}
        </p>
      </div>
      <NeInlineNotification
        v-if="actionError != undefined"
        kind="error"
        :title="actionError.title"
        :description="actionError.description"
      />
      <NeInlineNotification v-if="error != undefined" kind="error" :title="t('common.error')" />
      <template v-else-if="instance">
        <div class="flex flex-wrap gap-4">
          <NeTextInput
            v-model="peerFilter"
            is-search
            :placeholder="t('standalone.wireguard_tunnel.filter_peers')"
            class="mr-auto"
          />
          <NeButton kind="secondary" @click="showTunnelDrawer = true">
            <template #prefix>
              <FontAwesomeIcon :icon="faCirclePlus" aria-hidden="true" class="h-4 w-4" />
            </template>
            {{ t('standalone.wireguard_tunnel.add_server') }}
          </NeButton>
        </div>
        <WireguardTunnelDetailCard
          :key="instance.id"
          :instance="instance"
          :filter="peerFilter"
          @clear-filter="peerFilter = ''"
          @edit="editTunnel"
          @delete="deleteTunnel"
          @add-peer="addPeerHandler"
          @edit-peer="editPeerHandler"
          @delete-peer="deletePeerHandler"
          @logout-peer="logoutPeer"
          @download-peer-otp="downloadPeerOtp"
          @clear-peer-alerts="clearPeerAlerts"
          @allow-device-enrollment="allowDeviceEnrollment"
          @revoke-device="revokeDevice"
          @regenerate-peer-keys="(peer: Peer) => (peerToRegenerate = peer)"
        />
      </template>
      <NeEmptyState
        v-else
        :title="t('standalone.wireguard_tunnel.no_server_configured')"
        :icon="faGlobe"
      >
        <NeButton kind="primary" @click="showTunnelDrawer = true">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" aria-hidden="true" class="h-4 w-4" />
          </template>
          {{ t('standalone.wireguard_tunnel.add_server') }}
        </NeButton>
      </NeEmptyState>
    </div>
  </div>
  <TunnelDrawer
    :is-shown="showTunnelDrawer"
    :tunnel="editingTunnel"
    @success="createdTunnel"
    @close="closeTunnelDrawer"
  />
  <DeleteTunnelModal
    :instance="deletingTunnel"
    @success="tunnelDeleted"
    @close="closeDeleteModal"
  />
  <PeerDrawer
    :is-shown="showPeerDrawer"
    :instance="creatingPeerFor"
    :peer="editPeer"
    @close="closePeerDrawer"
    @success="addedPeerHandler"
  />
  <DeletePeerModal :peer="peerToDelete" @success="peerDeleted" @close="closeDeletePeerModal" />
  <RegeneratePeerKeysModal
    :peer="peerToRegenerate"
    @success="peerKeysRegenerated"
    @close="peerToRegenerate = undefined"
  />
</template>
