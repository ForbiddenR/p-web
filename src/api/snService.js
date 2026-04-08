import axios from 'axios'

const API_PATHS = {
  status: '/status',
  address: '/address',
  close: '/close',
}

const HEALTH_PATH = '/actuator/health'

const REQUEST_KEYS = {
  sn: 'sn',
}

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

function buildSnPayload(sn) {
  return { [REQUEST_KEYS.sn]: sn }
}

function getNestedValue(source, path) {
  return path.split('.').reduce((value, segment) => {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined
    }

    return value[segment]
  }, source)
}

function pickValue(source, paths) {
  for (const path of paths) {
    const value = getNestedValue(source, path)

    if (value !== undefined && value !== null) {
      return value
    }
  }

  return undefined
}

function unwrapPayload(payload) {
  return pickValue({ payload }, ['payload.data', 'payload.result', 'payload.payload']) ?? payload
}

function listObjectKeys(value) {
  if (value && typeof value === 'object') {
    return Object.keys(value)
  }

  return []
}

function parseFlag(value, truthy, falsy) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null
    }

    if (value === 0) {
      return false
    }

    if (value === 1) {
      return true
    }

    return null
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (truthy.includes(normalized)) {
      return true
    }

    if (falsy.includes(normalized)) {
      return false
    }
  }

  return null
}

function normalizeStatusResponse(payload) {
  const data = unwrapPayload(payload)
  const onlineValue = pickValue({ data, payload }, [
    'data.online',
    'data.isOnline',
    'data.is_online',
    'data.status.online',
    'data.device.online',
    'data.device.isOnline',
    'payload.online',
    'payload.isOnline',
    'payload.is_online',
  ])

  if (onlineValue !== undefined) {
    const parsed = parseFlag(onlineValue, ['1', 'true', 'yes', 'online', 'on'], ['0', 'false', 'no', 'offline', 'off'])

    if (parsed !== null) {
      return { online: parsed }
    }
  }

  const statusValue = pickValue({ data, payload }, [
    'data.status',
    'data.connectionStatus',
    'data.state',
    'data.device.status',
    'payload.status',
  ])

  if (statusValue !== undefined) {
    const parsed = parseFlag(statusValue, ['1', 'true', 'yes', 'online', 'on', 'connected'], [
      '0',
      'false',
      'no',
      'offline',
      'off',
      'disconnected',
    ])

    if (parsed !== null) {
      return { online: parsed }
    }
  }

  throw new Error(
    `Unrecognized status response shape. Got keys: ${listObjectKeys(payload).join(', ')} (unwrapped keys: ${listObjectKeys(
      data,
    ).join(', ')})`,
  )
}

function normalizeAddressResponse(payload) {
  const data = unwrapPayload(payload)
  const remoteAddr = pickValue({ data, payload }, [
    'data.remoteAddr',
    'data.remoteAddress',
    'data.remote_addr',
    'data.remote',
    'data.address.remoteAddr',
    'data.address.remoteAddress',
    'data.address.remote_addr',
    'data.connection.remoteAddr',
    'data.connection.remoteAddress',
    'payload.remoteAddr',
    'payload.remoteAddress',
    'payload.remote_addr',
  ])
  const localAddr = pickValue({ data, payload }, [
    'data.localAddr',
    'data.localAddress',
    'data.local_addr',
    'data.local',
    'data.address.localAddr',
    'data.address.localAddress',
    'data.address.local_addr',
    'data.connection.localAddr',
    'data.connection.localAddress',
    'payload.localAddr',
    'payload.localAddress',
    'payload.local_addr',
  ])

  if (remoteAddr === undefined && localAddr === undefined) {
    throw new Error(
      `Unrecognized address response shape. Got keys: ${listObjectKeys(payload).join(', ')} (unwrapped keys: ${listObjectKeys(
        data,
      ).join(', ')})`,
    )
  }

  return {
    remoteAddr: remoteAddr === undefined ? '' : String(remoteAddr),
    localAddr: localAddr === undefined ? '' : String(localAddr),
  }
}

function normalizeCloseResponse(payload) {
  const data = unwrapPayload(payload)
  const successValue = pickValue({ data, payload }, [
    'data.success',
    'data.ok',
    'data.closed',
    'data.isClosed',
    'data.is_closed',
    'payload.success',
    'payload.ok',
    'payload.closed',
  ])

  if (successValue !== undefined) {
    const parsed = parseFlag(successValue, ['1', 'true', 'yes', 'ok', 'success', 'closed'], [
      '0',
      'false',
      'no',
      'fail',
      'failed',
      'error',
    ])

    if (parsed !== null) {
      return { success: parsed }
    }
  }

  const codeValue = pickValue({ data, payload }, [
    'data.code',
    'data.statusCode',
    'data.status_code',
    'payload.code',
    'payload.statusCode',
  ])

  if (codeValue !== undefined) {
    const numeric = typeof codeValue === 'string' ? Number.parseInt(codeValue, 10) : codeValue

    if (Number.isFinite(numeric)) {
      return { success: numeric === 0 || numeric === 200 }
    }
  }

  const messageValue = pickValue({ data, payload }, ['data.message', 'data.status', 'payload.message', 'payload.status'])

  if (messageValue !== undefined) {
    const parsed = parseFlag(messageValue, ['1', 'true', 'yes', 'ok', 'success', 'closed'], [
      '0',
      'false',
      'no',
      'fail',
      'failed',
      'error',
    ])

    if (parsed !== null) {
      return { success: parsed }
    }
  }

  throw new Error(
    `Unrecognized close response shape. Got keys: ${listObjectKeys(payload).join(', ')} (unwrapped keys: ${listObjectKeys(
      data,
    ).join(', ')})`,
  )
}

/**
 * Check whether a device SN is online.
 * @param {string} sn - Device serial number
 * @returns {Promise<{ online: boolean }>}
 *
 * Adapt the endpoint / response mapping to your actual backend.
 */
export async function checkStatus(sn) {
  const res = await http.get(API_PATHS.status, { params: buildSnPayload(sn) })
  return normalizeStatusResponse(res.data)
}

/**
 * Get remote and local address of an online device.
 * @param {string} sn
 * @returns {Promise<{ remoteAddr: string, localAddr: string }>}
 */
export async function getAddress(sn) {
  const res = await http.get(API_PATHS.address, { params: buildSnPayload(sn) })
  return normalizeAddressResponse(res.data)
}

/**
 * Close the connection of a device.
 * @param {string} sn
 * @returns {Promise<{ success: boolean }>}
 */
export async function closeConnection(sn) {
  const res = await http.post(API_PATHS.close, buildSnPayload(sn))
  return normalizeCloseResponse(res.data)
}

/**
 * Get backend actuator health state.
 * @returns {Promise<{ healthy: boolean, status: string }>}
 */
export async function getBackendHealth() {
  const res = await axios.get(HEALTH_PATH, {
    timeout: 5000,
    validateStatus: () => true,
  })

  const healthy = res.status === 200

  return {
    healthy,
    status: healthy ? 'UP' : `HTTP ${res.status}`,
  }
}
