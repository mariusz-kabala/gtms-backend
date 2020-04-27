/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config()

const {
  QUEUE_HOST,
  VERSION,
  PORT,
  BUCKET_GROUP_LOGO,
  BUCKET_AVATAR,
  BUCKET_GROUP_BG,
  BUCKET_USER_GALLERY,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_ENDPOINT,
} = process.env

module.exports = {
  port: PORT,
  queueHost: QUEUE_HOST,
  serviceName: 'worker-files',
  serviceVersion: VERSION,
  awsAccessKeyId: AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: AWS_SECRET_ACCESS_KEY,
  awsRegion: AWS_REGION,
  awsEndpoint: AWS_ENDPOINT,
  buckets: {
    groupLogo: BUCKET_GROUP_LOGO,
    avatar: BUCKET_AVATAR,
    userGallery: BUCKET_USER_GALLERY,
    groupBg: BUCKET_GROUP_BG,
  },
  files: {
    groupLogo: [
      [
        {
          operation: 'resize',
          size: [200, 200],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '200x200',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '200x200',
        },
      ],
      [
        {
          operation: 'resize',
          size: [50, 50],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '50x50',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '50x50',
        },
      ],
      [
        {
          operation: 'resize',
          size: [35, 35],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '35x35',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '35x35',
        },
      ],
    ],
    avatar: [
      [
        {
          operation: 'resize',
          size: [1300, 1300],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '1300x1300',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '1300x1300',
        },
      ],
      [
        {
          operation: 'resize',
          size: [800, 800],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '800x800',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '800x800',
        },
      ],
      [
        {
          operation: 'resize',
          size: [200, 200],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '200x200',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '200x200',
        },
      ],
      [
        {
          operation: 'resize',
          size: [50, 50],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '50x50',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '50x50',
        },
      ],
      [
        {
          operation: 'resize',
          size: [35, 35],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '35x35',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '35x35',
        },
      ],
    ],
    userGallery: [
      [
        {
          operation: 'resize',
          size: [1300, 1300],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '1300x1300',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '1300x1300',
        },
      ],
      [
        {
          operation: 'resize',
          size: [800, 800],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '800x800',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '800x800',
        },
      ],
      [
        {
          operation: 'resize',
          size: [200, 200],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '200x200',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '200x200',
        },
      ],
      [
        {
          operation: 'resize',
          size: [50, 50],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '50x50',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '50x50',
        },
      ],
      [
        {
          operation: 'resize',
          size: [35, 35],
        },
        {
          operation: 'save',
          fileType: 'jpg',
          name: '35x35',
        },
        {
          operation: 'save',
          fileType: 'webp',
          name: '35x35',
        },
      ],
    ],
  },
}
