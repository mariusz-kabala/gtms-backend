import amqp from 'amqplib'
import { Queues, IUserUpdateMsg, UserUpdateTypes } from '@gtms/commons'
import {
  setupRetriesPolicy,
  IRetryPolicy,
  getSendMsgToRetryFunc,
} from '@gtms/client-queue'
import logger from '@gtms/lib-logger'
import { processJoinedGroupMsg } from './joinedGroup'
import { processLeftGroupMsg } from './leftGroup'
import { processGotGroupAdminRightsMsg } from './gotGroupAdminRights'
import { processLostGroupAdminRightsMsg } from './lostGroupAdminRights'
import { processCreatedGroupMsg } from './createdGroup'
import { processDeletedGroupMsg } from './deletedGroup'
import { processDescreasedPostsCounterMsg } from './descreasePostsCounter'
import { processIncreasePostsCounterMsg } from './increasePostsCounter'

const retryPolicy: IRetryPolicy = {
  queue: Queues.userUpdate,
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

const processMsg = (msg: amqp.Message) => {
  let jsonMsg: IUserUpdateMsg

  try {
    jsonMsg = JSON.parse(msg.content.toString())
  } catch (err) {
    logger.log({
      level: 'error',
      message: `Can not parse ${
        Queues.userUpdate
      } queue message: ${msg.content.toString()} / error: ${err}`,
    })
    return Promise.reject(`can not parse json`)
  }

  switch (jsonMsg.type) {
    case UserUpdateTypes.joinedGroup:
      return processJoinedGroupMsg(jsonMsg)

    case UserUpdateTypes.leftGroup:
      return processLeftGroupMsg(jsonMsg)

    case UserUpdateTypes.gotGroupAdminRights:
      return processGotGroupAdminRightsMsg(jsonMsg)

    case UserUpdateTypes.lostGroupAdminRights:
      return processLostGroupAdminRightsMsg(jsonMsg)

    case UserUpdateTypes.createdGroup:
      return processCreatedGroupMsg(jsonMsg)

    case UserUpdateTypes.deletedGroup:
      return processDeletedGroupMsg(jsonMsg)

    case UserUpdateTypes.increasePostsCounter:
      return processIncreasePostsCounterMsg(jsonMsg)

    case UserUpdateTypes.descreasePostsCounter:
      return processDescreasedPostsCounterMsg(jsonMsg)
  }
}

export function initUpdateTask(ch: amqp.Channel) {
  const ok = ch.assertQueue(Queues.userUpdate, { durable: true })

  ok.then(async () => {
    await setupRetriesPolicy(ch, retryPolicy)
    ch.prefetch(1)
  }).then(() => {
    ch.consume(
      Queues.userUpdate,
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
