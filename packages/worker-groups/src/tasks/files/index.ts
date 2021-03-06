import amqp from 'amqplib'
import { GroupModel, IGroup } from '@gtms/lib-models'
import logger from '@gtms/lib-logger'
import {
  Queues,
  IFileQueueMsg,
  FileStatus,
  FileTypes,
  getS3InfoFromUrl,
} from '@gtms/commons'
import {
  setupRetriesPolicy,
  IRetryPolicy,
  getSendMsgToRetryFunc,
  publishMultiple,
} from '@gtms/client-queue'

const retryPolicy: IRetryPolicy = {
  queue: Queues.updateGroupFiles,
  retries: [
    {
      name: '30s',
      ttl: 30000,
    },
    {
      name: '10m',
      ttl: 600000,
    },
    {
      name: '1h',
      ttl: 3600000,
    },
    {
      name: '8h',
      ttl: 28800000,
    },
    {
      name: '24h',
      ttl: 86400000,
    },
  ],
}

const sendMsgToRetry = getSendMsgToRetryFunc(retryPolicy)

export const FIELDS_WITH_FILES = ['avatar', 'bg', 'cover']

const getUpdatePayload = ({
  files,
  fileType,
  status,
}: {
  files: string[]
  fileType: FileTypes
  status: FileStatus
}): {
  [key in 'avatar' | 'bg' | 'cover']?: {
    files: string[]
    status: FileStatus
  }
} => {
  switch (fileType) {
    case FileTypes.groupLogo:
      return {
        avatar: {
          status,
          files,
        },
      }
    case FileTypes.groupBg:
      return {
        bg: {
          status,
          files,
        },
      }
    case FileTypes.groupCover:
      return {
        cover: {
          status,
          files,
        },
      }
    default:
      throw new Error(`File ${fileType} is not supported`)
  }
}

const processNewUpload = (payload: IFileQueueMsg) => {
  return new Promise(async (resolve, reject) => {
    const {
      data: { relatedRecord, owner, traceId, files, fileType, status } = {},
    } = payload
    const update = getUpdatePayload({
      files: files.map(f => f.url),
      fileType,
      status,
    })

    GroupModel.findOneAndUpdate(
      {
        _id: relatedRecord,
        owner,
      },
      update,
      {
        upsert: false,
        new: false,
      }
    )
      .then(async (group: IGroup | null) => {
        if (!group) {
          logger.log({
            level: 'error',
            message: `Someone tried to upload files to not existing group, payload: ${JSON.stringify(
              payload
            )}`,
            traceId,
          })
          return resolve()
        }

        const messagesToPublish: { queue: string; message: any }[] = [
          {
            queue: Queues.createFile,
            message: payload,
          },
        ]

        for (let x = 0; x < FIELDS_WITH_FILES.length; x++) {
          const key = FIELDS_WITH_FILES[x] as 'avatar' | 'bg' | 'cover'

          if (update[key] && Array.isArray(group[key].files)) {
            for (const url of group[key].files) {
              const s3Info = getS3InfoFromUrl(url)

              messagesToPublish.push({
                queue: Queues.deleteFile,
                message: {
                  data: {
                    ...s3Info,
                    traceId,
                  },
                },
              })
            }
          }
        }

        try {
          await publishMultiple(traceId, ...messagesToPublish)
        } catch (err) {
          logger.log({
            level: 'error',
            message: `Can not publish queue messages, error: ${err}`,
            traceId,
          })
        }

        resolve()
      })
      .catch(err => {
        logger.log({
          level: 'error',
          message: `Database error: ${err}`,
          traceId,
        })

        reject('database error')
      })
  })
}

const processReadyFiles = (msg: IFileQueueMsg) => {
  return new Promise((resolve, reject) => {
    const {
      data: { files, traceId, status, relatedRecord, fileType } = {},
    } = msg

    let payload

    try {
      payload = getUpdatePayload({
        files: files.map(f => f.url),
        fileType,
        status,
      })
    } catch (err) {
      return reject(err)
    }

    GroupModel.findOneAndUpdate(
      {
        _id: relatedRecord,
      },
      payload,
      {
        upsert: false,
      }
    )
      .then((group: IGroup | null) => {
        if (group) {
          logger.log({
            level: 'info',
            message: `Group ${relatedRecord} has been updated with ${fileType} files`,
            traceId,
          })
        } else {
          logger.log({
            level: 'error',
            message: `Can not update files for group ${relatedRecord} - record does not exist`,
            traceId,
          })
        }

        resolve()
      })
      .catch(err => {
        logger.log({
          level: 'error',
          message: `Database error ${err}`,
          traceId,
        })

        reject('database error')
      })
  })
}

const processMsg = (msg: amqp.Message) => {
  let jsonMsg: IFileQueueMsg

  try {
    jsonMsg = JSON.parse(msg.content.toString())
  } catch (err) {
    logger.log({
      level: 'error',
      message: `Can not parse ${
        Queues.updateGroupFiles
      } queue message: ${msg.content.toString()} / error: ${err}`,
    })
    return Promise.reject(`can not parse json`)
  }

  const { data: { status } = {} } = jsonMsg

  switch (status) {
    case FileStatus.uploaded:
      return processNewUpload(jsonMsg)

    case FileStatus.ready:
      return processReadyFiles(jsonMsg)

    default:
      // ignore any other status
      return Promise.resolve()
  }
}

export function initFilesTask(ch: amqp.Channel) {
  const ok = ch.assertQueue(Queues.updateGroupFiles, { durable: true })

  ok.then(async () => {
    await setupRetriesPolicy(ch, retryPolicy)
    ch.prefetch(1)
  }).then(() => {
    ch.consume(
      Queues.updateGroupFiles,
      msg => {
        if (msg.fields.redelivered) {
          return sendMsgToRetry({
            msg,
            channel: ch,
            reasonOfFail:
              'Message was redelivered, so something wrong happened',
          })
        }

        processMsg(msg)
          .catch(err => {
            sendMsgToRetry({
              msg,
              channel: ch,
              reasonOfFail: err,
            })
          })
          .finally(() => {
            ch.ack(msg)
          })
      },
      {
        noAck: false,
      }
    )
  })
}
