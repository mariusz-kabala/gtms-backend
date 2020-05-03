/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config()

const {
  AUTH_SERVICE_URL,
  GROUPS_SERVICE_URL,
  AUTH_SERVICE_KEY,
  GROUPS_SERVICE_KEY,
  VERSION,
  PORT,
} = process.env

module.exports = {
  serviceName: 'gatekeeper-internal',
  serviceVersion: VERSION,
  services: {
    auth: `http://${AUTH_SERVICE_URL}`,
    groups: `http://${GROUPS_SERVICE_URL}`,
  },
  appKeys: {
    auth: AUTH_SERVICE_KEY,
    groups: GROUPS_SERVICE_KEY,
  },
  port: PORT,
}
