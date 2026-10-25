<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts" setup>
import type { Peer } from '@/views/standalone/vpn/WireguardTunnelView.vue'
import { NeInlineNotification, NeModal, getAxiosErrorMessage } from '@nethesis/vue-components'
import { ubusCall } from '@/lib/standalone/ubus.ts'
import { ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { peer = undefined } = defineProps<{
  peer?: Peer
}>()

const emit = defineEmits(['success', 'close'])

const _internalPeer = ref<Peer>()
const loading = ref(false)
const error = ref<Error>()

watchEffect(() => {
  if (peer != undefined) {
    _internalPeer.value = peer
    loading.value = false
    error.value = undefined
  }
})

function regenerateKeys() {
  error.value = undefined
  loading.value = true
  ubusCall('ns.wireguard', 'regenerate-peer-keys', {
    id: _internalPeer.value!.id
  })
    .then(() => emit('success'))
    .catch((err) => {
      error.value = err
      loading.value = false
    })
}
</script>

<template>
  <NeModal
    :cancel-label="t('common.cancel')"
    :close-aria-label="t('common.close')"
    :primary-button-disabled="loading"
    :primary-button-loading="loading"
    :primary-label="t('standalone.wireguard_tunnel.generate_keys')"
    :title="t('standalone.wireguard_tunnel.regenerate_peer_keys_title')"
    :visible="peer != undefined"
    kind="warning"
    primary-button-kind="danger"
    @close="
      () => {
        if (!loading) {
          emit('close')
        }
      }
    "
    @primary-click="regenerateKeys"
  >
    <p>
      {{
        t('standalone.wireguard_tunnel.regenerate_peer_keys_confirm', { name: _internalPeer?.name })
      }}
    </p>
    <NeInlineNotification
      v-if="error != undefined"
      class="mt-4"
      kind="error"
      :title="t('standalone.wireguard_tunnel.error_regenerating_peer_keys')"
      :description="t(getAxiosErrorMessage(error))"
    />
  </NeModal>
</template>
