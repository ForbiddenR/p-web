import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

/**
 * Check whether a device SN is online.
 * @param {string} sn - Device serial number
 * @returns {Promise<{ online: boolean }>}
 *
 * Adapt the endpoint / response mapping to your actual backend.
 */
export async function checkStatus(sn) {
  const res = await http.get('/status', { params: { sn } })
  return res.data // expected: { online: true/false }
}

/**
 * Get remote and local address of an online device.
 * @param {string} sn
 * @returns {Promise<{ remoteAddr: string, localAddr: string }>}
 */
export async function getAddress(sn) {
  const res = await http.get('/address', { params: { sn } })
  return res.data // expected: { remoteAddr: '...', localAddr: '...' }
}

/**
 * Close the connection of a device.
 * @param {string} sn
 * @returns {Promise<{ success: boolean }>}
 */
export async function closeConnection(sn) {
  const res = await http.post('/close', { sn })
  return res.data // expected: { success: true/false }
}
