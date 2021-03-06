import express, { Router, Request, Response } from 'express'
import bodyParser from 'body-parser'
import morgan from 'morgan'
import logger, { stream } from '@gtms/lib-logger'
import mongoose from '@gtms/client-mongoose'
import groupsController from './controllers/group'
import membersController from './controllers/members'
import findController from './controllers/find'
import adminController from './controllers/admins'
import invitationController from './controllers/invitations'
import {
  JWTMiddleware,
  errorMiddleware,
  traceIDMiddleware,
  getAppInfoMiddleware,
} from '@gtms/lib-middlewares'

const app = express()
const router: Router = Router()

mongoose.connection.on('error', err => {
  logger.error(`${err}`)
  process.exit(1)
})

router.get('/managment/heath', (_: Request, res: Response) => {
  res.status(200).json({
    status: 'up',
  })
})

router.post('/', JWTMiddleware, groupsController.create)
router.get('/', findController.list)
router.get('/tag', findController.byTags)

router.get('/check-admin-rights', groupsController.hasAdminAccess) // internal
router.get('/can-add-post', groupsController.canAddPost) // internal
router.post('/find-by-ids', findController.findByIds) // internal

router.get('/:slug/join', JWTMiddleware, membersController.joinGroup)
router.get('/:slug/leave', JWTMiddleware, membersController.leaveGroup)
router.post(
  '/:slug/invitations',
  JWTMiddleware,
  invitationController.createInvitation
)
router.get(
  '/:slug/invitations',
  JWTMiddleware,
  invitationController.groupInvitations
)
router.post(
  '/:slug/requests',
  JWTMiddleware,
  invitationController.createRequest
)
router.get('/:slug/requests', JWTMiddleware, invitationController.groupRequests)
router.get(
  '/invitations/my',
  JWTMiddleware,
  invitationController.userInvitations
)
router.delete(
  '/invitations/:id',
  JWTMiddleware,
  invitationController.deleteInvitation
)

router.get('/:slug', groupsController.show)
router.post('/:slug', JWTMiddleware, groupsController.update)

router.get('/:slug/members', membersController.list)
router.delete(
  '/:slug/members/:user',
  JWTMiddleware,
  membersController.removeMember
)
router.get('/:slug/admins', adminController.list)
router.post('/:slug/admins', JWTMiddleware, adminController.addAdmin)
router.delete('/:slug/admins/:user', JWTMiddleware, adminController.removeAdmin)

router.all('*', (_: Request, res: Response) => {
  res.status(404).json({ status: 'not found' })
})

app.disable('x-powered-by')
app.use(getAppInfoMiddleware())
app.use(traceIDMiddleware)
app.use(
  morgan(
    (tokens, req, res) => {
      return [
        res.get('x-traceid'),
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'),
        '-',
        tokens['response-time'](req, res),
        'ms',
      ].join(' ')
    },
    { stream }
  )
)
app.use(bodyParser.json())
app.use('/', router)
app.use(errorMiddleware)

export { app }
