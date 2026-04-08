<template>
  <div class="sn-checker">
    <h2>SN Online Status Checker</h2>

    <div class="backend-health">
      <span class="backend-health__label">Backend</span>
      <span class="backend-health__badge" :class="backendHealthState" :title="backendHealthTitle">
        {{ backendHealthText }}
      </span>
      <span v-if="backendLastCheckedLabel" class="backend-health__meta">
        Last checked {{ backendLastCheckedLabel }}
      </span>
    </div>

    <div class="input-row">
      <input
        v-model.trim="sn"
        type="text"
        placeholder="Enter device SN"
        autocomplete="off"
        @keyup.enter="handleCheck"
        :disabled="loading || closing"
      />
      <button @click="handleCheck" :disabled="!sn || loading || closing">
        {{ loading ? 'Checking...' : 'Check' }}
      </button>
    </div>

    <div v-if="error" class="message error">{{ error }}</div>
    <div v-if="successMsg" class="message success">{{ successMsg }}</div>

    <div v-if="status !== null" class="status-section">
      <span class="status-badge" :class="status">
        {{ status === 'online' ? '● Online' : '○ Offline' }}
      </span>
    </div>

    <div v-if="status === 'online' && address" class="address-panel">
      <h3>Connection Details</h3>
      <table>
        <tr>
          <td class="label">Remote Address</td>
          <td class="value">{{ address.remoteAddr || '—' }}</td>
        </tr>
        <tr>
          <td class="label">Local Address</td>
          <td class="value">{{ address.localAddr || '—' }}</td>
        </tr>
      </table>
    </div>

    <div v-if="status === 'online'" class="close-section">
      <button class="btn-close" @click="handleClose" :disabled="closing || loading">
        {{ closing ? 'Closing...' : 'Close Connection' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { checkStatus, closeConnection, getAddress, getBackendHealth } from '../api/snService'

const HEALTH_POLL_INTERVAL_MS = 5000

const sn = ref('')
const loading = ref(false)
const closing = ref(false)
const status = ref(null) // null | 'online' | 'offline'
const address = ref(null) // null | { remoteAddr: string, localAddr: string }
const error = ref(null)
const successMsg = ref(null)

const backendHealthState = ref('checking') // 'checking' | 'up' | 'down'
const backendHealthStatus = ref(null) // 'UP' | 'DOWN' | ...
const backendHealthError = ref(null)
const backendLastCheckedAt = ref(null)

let healthPollTimeoutId = null
let healthPollCancelled = false

function resetState() {
  status.value = null
  address.value = null
  error.value = null
  successMsg.value = null
}

function normalizeErrorMessage(err) {
  if (!err) return 'Unknown error'

  const axiosMessage = err?.response?.data?.message

  if (typeof axiosMessage === 'string' && axiosMessage.trim()) {
    return axiosMessage.trim()
  }

  if (typeof err.message === 'string' && err.message.trim()) {
    return err.message.trim()
  }

  return String(err)
}

function showError(message) {
  error.value = message
  successMsg.value = null
}

const backendHealthText = computed(() => {
  if (backendHealthState.value === 'checking') return 'Checking...'
  return backendHealthStatus.value || 'Unknown'
})

const backendHealthTitle = computed(() => {
  if (backendHealthError.value) return backendHealthError.value
  if (backendHealthState.value === 'checking') return 'Polling /actuator/health'
  return 'Polling /actuator/health'
})

const backendLastCheckedLabel = computed(() => {
  if (!backendLastCheckedAt.value) return ''
  return backendLastCheckedAt.value.toLocaleTimeString()
})

async function refreshBackendHealth() {
  try {
    const res = await getBackendHealth()

    if (healthPollCancelled) return

    backendHealthStatus.value = res.status
    backendHealthError.value = null
    backendHealthState.value = res.healthy ? 'up' : 'down'
  } catch (err) {
    if (healthPollCancelled) return

    backendHealthStatus.value = 'UNREACHABLE'
    backendHealthError.value = normalizeErrorMessage(err)
    backendHealthState.value = 'down'
  } finally {
    if (healthPollCancelled) return

    backendLastCheckedAt.value = new Date()
    healthPollTimeoutId = window.setTimeout(pollBackendHealth, HEALTH_POLL_INTERVAL_MS)
  }
}

function pollBackendHealth() {
  if (healthPollCancelled) return

  refreshBackendHealth()
}

onMounted(() => {
  pollBackendHealth()
})

onBeforeUnmount(() => {
  healthPollCancelled = true

  if (healthPollTimeoutId) {
    window.clearTimeout(healthPollTimeoutId)
  }
})

async function handleCheck() {
  if (!sn.value) return

  resetState()
  loading.value = true

  try {
    const statusRes = await checkStatus(sn.value)

    if (statusRes.online) {
      status.value = 'online'

      try {
        address.value = await getAddress(sn.value)
      } catch (err) {
        showError(`Device is online but failed to fetch address: ${normalizeErrorMessage(err)}`)
      }
    } else {
      status.value = 'offline'
    }
  } catch (err) {
    showError(`Failed to check status: ${normalizeErrorMessage(err)}`)
  } finally {
    loading.value = false
  }
}

async function handleClose() {
  if (!sn.value) return

  const confirmed = window.confirm(`Are you sure you want to close the connection for SN: ${sn.value}?`)
  if (!confirmed) return

  closing.value = true
  error.value = null

  try {
    const res = await closeConnection(sn.value)

    if (res.success) {
      successMsg.value = `Connection for SN ${sn.value} has been closed.`
      status.value = null
      address.value = null
    } else {
      showError('Backend returned failure when closing connection.')
    }
  } catch (err) {
    showError(`Failed to close connection: ${normalizeErrorMessage(err)}`)
  } finally {
    closing.value = false
  }
}
</script>

<style scoped>
.sn-checker {
  max-width: 520px;
  margin: 60px auto;
  padding: 24px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
}

h2 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 20px;
  color: #333;
}

.backend-health {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  font-size: 13px;
  color: #666;
}

.backend-health__label {
  font-weight: 600;
  color: #444;
}

.backend-health__badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  user-select: none;
}

.backend-health__badge.checking {
  background: #fafafa;
  color: #8c8c8c;
  border-color: #d9d9d9;
}

.backend-health__badge.up {
  background: #f6ffed;
  color: #389e0d;
  border-color: #b7eb8f;
}

.backend-health__badge.down,
.backend-health__badge.error {
  background: #fff2f0;
  color: #cf1322;
  border-color: #ffccc7;
}

.backend-health__meta {
  font-size: 12px;
  color: #8c8c8c;
}

.input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.input-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.input-row button {
  padding: 8px 20px;
  background: #1677ff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.input-row button:disabled {
  background: #a0c4ff;
  cursor: not-allowed;
}

.message {
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
}

.message.error {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #cf1322;
}

.message.success {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #389e0d;
}

.status-section {
  margin-bottom: 16px;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.status-badge.online {
  background: #f6ffed;
  color: #389e0d;
  border: 1px solid #b7eb8f;
}

.status-badge.offline {
  background: #f5f5f5;
  color: #8c8c8c;
  border: 1px solid #d9d9d9;
}

.address-panel {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
}

.address-panel h3 {
  margin: 0 0 10px;
  font-size: 14px;
  color: #555;
}

.address-panel table {
  width: 100%;
  border-collapse: collapse;
}

.address-panel td {
  padding: 6px 0;
  font-size: 13px;
}

.address-panel .label {
  color: #888;
  width: 130px;
}

.address-panel .value {
  color: #333;
  font-family: 'Courier New', monospace;
  word-break: break-word;
}

.close-section {
  margin-top: 8px;
}

.btn-close {
  padding: 8px 20px;
  background: #ff4d4f;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-close:disabled {
  background: #ffa39e;
  cursor: not-allowed;
}

.btn-close:hover:not(:disabled) {
  background: #ff7875;
}
</style>
