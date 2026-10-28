<script setup lang="ts">
import {
  NeSideDrawer,
  NeToggle,
  NeFormItemLabel,
  NeTextInput,
  NeTooltip,
  NeButton,
  NeInlineNotification,
  NeRadioSelection,
  NeCombobox,
  type NeComboboxOption
} from '@nethesis/vue-components'
import { useI18n } from 'vue-i18n'
import { computed, ref, watch } from 'vue'
import { ubusCall, ValidationError } from '@/lib/standalone/ubus'
import type { AxiosResponse } from 'axios'
import AdvancedSettingsDropdown from '@/components/AdvancedSettingsDropdown.vue'
import * as v from 'valibot'
import { MessageBag } from '@/lib/validation.ts'
import type { Tunnel, WireguardAuthMode } from '@/views/standalone/vpn/WireguardTunnelView.vue'
import NeMultiTextInput from '@/components/standalone/NeMultiTextInput.vue'

const { t } = useI18n()

const { isShown, tunnel = undefined } = defineProps<{
  isShown: boolean
  tunnel?: Tunnel
}>()

const DEFAULT_SESSION_HOURS = '8'
const MAX_SESSION_HOURS = 168

const enabled = ref(true)
const statusLabel = computed<string>(() => {
  return enabled.value ? t('common.enabled') : t('common.disabled')
})
const tunnelName = ref('')
const network = ref('')
const udpPort = ref('')
const publicIp = ref('')
// other addresses of the server, for the clients that support them: shown only if the firewall supports it
const maxFallbackEndpoints = ref(0)
const fallbackEndpoints = ref<string[]>([])
const mtu = ref('')
const dnsServers = ref<string[]>([''])
// login with user credentials: shown only if the firewall supports it
const supportsLogin = ref(false)
const authMode = ref<WireguardAuthMode>('key')
const userDatabase = ref('')
const sessionHours = ref(DEFAULT_SESSION_HOURS)
const userDatabaseOptions = ref<NeComboboxOption[]>([])
const errorLoadingDatabases = ref(false)
// device binding, on servers with a login: shown only if the firewall supports it
const supportsDeviceBinding = ref(false)
const deviceBinding = ref(false)
const machineId = ref(false)
// once the login is required, the peers without a user can't use the VPN
const peersWithoutUser = computed<string[]>(() =>
  (tunnel?.peers ?? []).filter((peer) => !peer.user).map((peer) => peer.name)
)

const authModeOptions = [
  {
    id: 'key',
    label: t('standalone.wireguard_tunnel.auth_mode_key'),
    description: t('standalone.wireguard_tunnel.auth_mode_key_description')
  },
  {
    id: 'key_password',
    label: t('standalone.wireguard_tunnel.auth_mode_key_password'),
    description: t('standalone.wireguard_tunnel.auth_mode_key_password_description')
  },
  {
    id: 'key_password_otp',
    label: t('standalone.wireguard_tunnel.auth_mode_key_password_otp'),
    description: t('standalone.wireguard_tunnel.auth_mode_key_password_otp_description')
  }
]

type ServerSetup = AxiosResponse<{
  listen_port: number
  network: string
  public_endpoint: string
  auth_modes?: WireguardAuthMode[]
  max_fallback_endpoints?: number
  device_binding?: boolean
}>

// the most fallback endpoints of a server, when editing one: the list of the server tells only that they're supported
const DEFAULT_MAX_FALLBACK_ENDPOINTS = 4

const disableForm = ref(false)
const errorFetchingServerSetup = ref(false)
const tunnelInstance = ref('')
function loadSuggestions() {
  tunnelInstance.value = ''
  disableForm.value = true
  errorFetchingServerSetup.value = false
  ubusCall<ServerSetup>('ns.wireguard', 'get-instance-defaults')
    .then((result) => {
      network.value = result.data.network
      udpPort.value = result.data.listen_port.toString()
      publicIp.value = result.data.public_endpoint
      supportsLogin.value = result.data.auth_modes != undefined
      maxFallbackEndpoints.value = result.data.max_fallback_endpoints ?? 0
      supportsDeviceBinding.value = result.data.device_binding == true
    })
    .catch(() => (errorFetchingServerSetup.value = true))
    .finally(() => (disableForm.value = false))
}

type DatabaseList = AxiosResponse<{
  databases: { name: string; type: string; description: string }[]
}>

function loadDatabases() {
  errorLoadingDatabases.value = false
  ubusCall<DatabaseList>('ns.users', 'list-databases')
    .then((result) => {
      // the login supports only local databases
      userDatabaseOptions.value = result.data.databases
        .filter((database) => database.type == 'local')
        .map((database) => ({
          id: database.name,
          label:
            database.name == 'main'
              ? t('standalone.wireguard_tunnel.local_database')
              : database.name,
          description: database.description
        }))
      const first = userDatabaseOptions.value[0]
      if (userDatabase.value == '' && first != undefined) {
        userDatabase.value = first.id
      }
    })
    .catch(() => (errorLoadingDatabases.value = true))
}

const validation = ref(new MessageBag())

const editing = ref(false)

watch(
  () => isShown,
  (newVal) => {
    if (newVal) {
      loading.value = false
      editing.value = false
      tunnelName.value = ''
      enabled.value = true
      network.value = ''
      udpPort.value = ''
      publicIp.value = ''
      maxFallbackEndpoints.value = 0
      fallbackEndpoints.value = []
      mtu.value = ''
      dnsServers.value = ['']
      supportsLogin.value = false
      authMode.value = 'key'
      userDatabase.value = ''
      sessionHours.value = DEFAULT_SESSION_HOURS
      supportsDeviceBinding.value = false
      deviceBinding.value = false
      machineId.value = false
      validation.value.clear()
      if (tunnel != undefined) {
        tunnelName.value = tunnel.name
        enabled.value = tunnel.enabled
        network.value = tunnel.network
        udpPort.value = tunnel.listen_port.toString()
        publicIp.value = tunnel.public_endpoint
        if (tunnel.fallback_endpoints != undefined) {
          maxFallbackEndpoints.value = DEFAULT_MAX_FALLBACK_ENDPOINTS
          fallbackEndpoints.value = [...tunnel.fallback_endpoints]
        }
        if (tunnel.mtu > 0) {
          mtu.value = tunnel.mtu.toString()
        } else {
          mtu.value = ''
        }
        if (tunnel.dns.length > 0) {
          dnsServers.value = tunnel.dns
        } else {
          dnsServers.value = ['']
        }
        if (tunnel.auth_mode != undefined) {
          supportsLogin.value = true
          authMode.value = tunnel.auth_mode
          userDatabase.value = tunnel.user_db ?? ''
          if (tunnel.auth_timeout) {
            sessionHours.value = Math.max(Math.round(tunnel.auth_timeout / 3600), 1).toString()
          }
        }
        if (tunnel.device_binding != undefined) {
          supportsDeviceBinding.value = true
          deviceBinding.value = tunnel.device_binding
          machineId.value = tunnel.machine_id ?? false
        }
        editing.value = true
        disableForm.value = false
      } else {
        loadSuggestions()
      }
      loadDatabases()
    }
  },
  { immediate: true }
)

const emit = defineEmits(['close', 'success'])

function validate() {
  validation.value.clear()

  const RequiredString = v.pipe(v.string(), v.nonEmpty('error.required'))

  const validator = v.object({
    name: RequiredString,
    network: RequiredString,
    udpPort: v.number('error.invalid'),
    publicIp: RequiredString
  })

  type validatorSchema = typeof validator

  const check = v.safeParse(validator, {
    name: tunnelName.value,
    network: network.value,
    udpPort: Number(udpPort.value),
    publicIp: publicIp.value
  })

  if (!check.success) {
    const flatted = v.flatten<validatorSchema>(check.issues).nested
    for (const key in flatted) {
      validation.value.set(key, flatted[key as v.IssueDotPath<validatorSchema>]![0])
    }
  }

  if (supportsLogin.value && authMode.value != 'key') {
    if (userDatabase.value == '') {
      validation.value.set('user_db', 'error.required')
    }
    const hours = Number(sessionHours.value)
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_SESSION_HOURS) {
      validation.value.set('auth_timeout', 'standalone.wireguard_tunnel.session_length_invalid')
    }
  }

  return validation.value.size == 0
}

// sent only to the firewalls that know them: the others would ignore them
function fallbackParameters() {
  if (maxFallbackEndpoints.value == 0) {
    return {}
  }
  return { fallback_endpoints: fallbackEndpoints.value.map((item) => item.trim()).filter(Boolean) }
}

function loginParameters() {
  if (!supportsLogin.value) {
    return {}
  }
  if (authMode.value == 'key') {
    return { auth_mode: authMode.value }
  }
  return {
    auth_mode: authMode.value,
    user_db: userDatabase.value,
    auth_timeout: Number(sessionHours.value) * 3600,
    // sent only to the firewalls that know them: missing, they keep their values
    ...(supportsDeviceBinding.value
      ? { device_binding: deviceBinding.value, machine_id: deviceBinding.value && machineId.value }
      : {})
  }
}

const loading = ref(false)
const error = ref<Error>()
function submitForm() {
  if (!validate()) {
    return
  }
  error.value = undefined
  disableForm.value = true
  loading.value = true
  let method: Promise<unknown>
  if (editing.value) {
    method = ubusCall('ns.wireguard', 'edit-server', {
      instance: tunnel!.id,
      enabled: enabled.value,
      name: tunnelName.value,
      public_endpoint: publicIp.value,
      listen_port: Number(udpPort.value),
      network: network.value,
      mtu: mtu.value,
      dns: dnsServers.value,
      ...fallbackParameters(),
      ...loginParameters()
    })
  } else {
    method = ubusCall('ns.wireguard', 'add-server', {
      enabled: enabled.value,
      name: tunnelName.value,
      public_endpoint: publicIp.value,
      listen_port: Number(udpPort.value),
      network: network.value,
      mtu: mtu.value,
      dns: dnsServers.value,
      ...fallbackParameters(),
      ...loginParameters()
    })
  }
  method
    .then(() => emit('success'))
    .catch((err) => {
      if (err instanceof ValidationError) {
        validation.value = err.errorBag
      } else {
        error.value = err
      }
      loading.value = false
      disableForm.value = false
    })
}

const drawerTitle = computed(() => {
  if (editing.value) {
    return t('standalone.wireguard_tunnel.edit_server')
  } else {
    return t('standalone.wireguard_tunnel.add_server')
  }
})

const saveButtonLabel = computed(() => {
  if (editing.value) {
    return t('common.save')
  } else {
    return t('standalone.wireguard_tunnel.add_server')
  }
})
</script>

<template>
  <NeSideDrawer :is-shown="isShown" :title="drawerTitle" @close="$emit('close')">
    <form class="space-y-8" @submit.prevent="submitForm">
      <NeInlineNotification
        v-if="errorFetchingServerSetup"
        :description="t('standalone.wireguard_tunnel.error_fetching_server_setup_description')"
        :title="t('standalone.wireguard_tunnel.error_fetching_server_setup')"
        kind="error"
      />
      <template v-else>
        <NeInlineNotification
          v-if="editing"
          :description="t('standalone.wireguard_tunnel.warning_editing_server_description')"
          :title="t('standalone.wireguard_tunnel.warning_editing_server')"
          kind="warning"
        />
        <div>
          <NeFormItemLabel>{{ t('standalone.wireguard_tunnel.status') }}</NeFormItemLabel>
          <NeToggle v-model="enabled" :label="statusLabel" />
        </div>
        <NeTextInput
          v-model="tunnelName"
          :disabled="disableForm"
          :invalid-message="t(validation.getFirstI18nKeyFor('name'))"
          :label="t('standalone.wireguard_tunnel.name')"
        />
        <NeTextInput
          v-model="network"
          :disabled="disableForm || editing"
          :invalid-message="t(validation.getFirstI18nKeyFor('network'))"
          :label="t('standalone.wireguard_tunnel.vpn_network')"
        >
          <template #tooltip>
            <NeTooltip>
              <template #content>
                {{ t('standalone.wireguard_tunnel.vpn_network_tooltip') }}
              </template>
            </NeTooltip>
          </template>
        </NeTextInput>
        <NeTextInput
          v-model="udpPort"
          :disabled="disableForm || editing"
          :label="t('standalone.wireguard_tunnel.udp_port')"
          :invalid-message="t(validation.getFirstI18nKeyFor('listen_port'))"
        />
        <NeTextInput
          v-model="publicIp"
          :disabled="disableForm"
          :label="t('standalone.wireguard_tunnel.public_endpoint')"
          :invalid-message="t(validation.getFirstI18nKeyFor('publicIp'))"
        />
        <NeMultiTextInput
          v-if="maxFallbackEndpoints > 0"
          v-model="fallbackEndpoints"
          :add-item-label="t('standalone.wireguard_tunnel.add_fallback_endpoint')"
          optional
          :disable-add-button="disableForm || fallbackEndpoints.length >= maxFallbackEndpoints"
          :disable-inputs="disableForm"
          :general-invalid-message="t(validation.getFirstI18nKeyFor('fallback_endpoints'))"
          :helper-text="t('standalone.wireguard_tunnel.fallback_endpoints_helper')"
          :optional-label="t('common.optional')"
          :placeholder="t('standalone.wireguard_tunnel.fallback_endpoint_placeholder')"
          :title="t('standalone.wireguard_tunnel.fallback_endpoints')"
        />
        <template v-if="supportsLogin">
          <NeRadioSelection
            v-model="authMode"
            card
            :label="t('standalone.wireguard_tunnel.authentication')"
            :options="authModeOptions"
          />
          <NeInlineNotification
            v-if="validation.has('auth_mode')"
            kind="error"
            :title="t('standalone.wireguard_tunnel.cannot_change_authentication')"
            :description="t(validation.getFirstI18nKeyFor('auth_mode'))"
          />
          <template v-if="authMode != 'key'">
            <NeInlineNotification
              v-if="errorLoadingDatabases"
              kind="error"
              :title="t('standalone.wireguard_tunnel.error_loading_databases')"
            />
            <NeCombobox
              v-model="userDatabase"
              :disabled="disableForm"
              :label="t('standalone.wireguard_tunnel.user_database')"
              :options="userDatabaseOptions"
              :invalid-message="t(validation.getFirstI18nKeyFor('user_db'))"
              :no-options-label="t('ne_combobox.no_options_label')"
              :no-results-label="t('ne_combobox.no_results')"
              :optional-label="t('common.optional')"
              :selected-label="t('ne_combobox.selected')"
              :limited-options-label="t('ne_combobox.limited_options_label')"
              :user-input-label="t('ne_combobox.user_input_label')"
            />
            <NeTextInput
              v-model="sessionHours"
              type="number"
              min="1"
              :max="MAX_SESSION_HOURS"
              :disabled="disableForm"
              :label="t('standalone.wireguard_tunnel.session_length')"
              :invalid-message="t(validation.getFirstI18nKeyFor('auth_timeout'))"
            >
              <template #tooltip>
                <NeTooltip>
                  <template #content>
                    {{ t('standalone.wireguard_tunnel.session_length_tooltip') }}
                  </template>
                </NeTooltip>
              </template>
            </NeTextInput>
            <NeInlineNotification
              v-if="peersWithoutUser.length > 0"
              kind="warning"
              :title="t('standalone.wireguard_tunnel.peers_without_user')"
              :description="
                t('standalone.wireguard_tunnel.peers_without_user_description', {
                  names: peersWithoutUser.join(', ')
                })
              "
            />
            <template v-if="supportsDeviceBinding">
              <div>
                <NeFormItemLabel>
                  {{ t('standalone.wireguard_tunnel.device_binding') }}
                  <NeTooltip>
                    <template #content>
                      {{ t('standalone.wireguard_tunnel.device_binding_description') }}
                    </template>
                  </NeTooltip>
                </NeFormItemLabel>
                <NeToggle
                  v-model="deviceBinding"
                  :disabled="disableForm"
                  :label="t('standalone.wireguard_tunnel.device_binding_label')"
                />
                <p
                  v-if="validation.has('device_binding')"
                  class="mt-2 text-sm text-rose-700 dark:text-rose-400"
                >
                  {{ t(validation.getFirstI18nKeyFor('device_binding')) }}
                </p>
              </div>
              <div v-if="deviceBinding">
                <NeFormItemLabel>
                  {{ t('standalone.wireguard_tunnel.machine_id') }}
                  <NeTooltip>
                    <template #content>
                      {{ t('standalone.wireguard_tunnel.machine_id_description') }}
                    </template>
                  </NeTooltip>
                </NeFormItemLabel>
                <NeToggle
                  v-model="machineId"
                  :disabled="disableForm"
                  :label="t('standalone.wireguard_tunnel.machine_id_label')"
                />
              </div>
            </template>
          </template>
        </template>
        <AdvancedSettingsDropdown>
          <NeTextInput
            v-model="mtu"
            :disabled="disableForm"
            :label="t('standalone.wireguard_tunnel.mtu')"
            optional
          />
          <NeMultiTextInput
            v-model="dnsServers"
            :add-item-label="t('standalone.wireguard_tunnel.add_dns')"
            optional
            :disable-add-button="disableForm"
            :disable-inputs="disableForm"
            :general-invalid-message="t(validation.getFirstI18nKeyFor('dns'))"
            :optional-label="t('common.optional')"
            :title="t('standalone.wireguard_tunnel.dns_servers')"
            required
          />
        </AdvancedSettingsDropdown>
      </template>
      <hr />
      <div class="flex justify-end gap-6">
        <NeButton kind="tertiary" :disabled="disableForm" @click="$emit('close')">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton
          v-if="!errorFetchingServerSetup"
          :disabled="disableForm"
          :loading="loading"
          kind="primary"
          type="submit"
        >
          {{ saveButtonLabel }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
