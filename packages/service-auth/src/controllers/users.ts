import {
  IUser,
  IGroup,
  UserModel,
  RefreshTokenModel,
  IRefreshToken,
  serializeUser,
} from '@gtms/lib-models'
import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import logger from '@gtms/lib-logger'
import { findGroupsByIds } from '@gtms/lib-api'
import { arrayUnique, arrayToHash } from '@gtms/commons'
import authenticate, { getJWTData } from '../helpers/authenticate'
import config from 'config'
import serializeCookie from '../helpers/cookies'
import sendActivationEmail from '../helpers/sendActivationEmail'

export default {
  count(_: Request, res: Response, next: NextFunction): void {
    UserModel.estimatedDocumentCount({})
      .then((counter: number) => {
        res.status(200).json({ counter })
      })
      .catch(err => {
        next(err)
      })
  },
  create(req: Request, res: Response, next: NextFunction): void {
    const { body } = req

    UserModel.create({
      name: body.name,
      surname: body.surname,
      email: body.email,
      phone: body.phone,
      password: body.password,
      countryCode: body.countryCode,
      languageCode: body.languageCode,
    })
      .then((user: IUser) => {
        const { name, surname, email } = user

        logger.log({
          message: `New user with email ${email} and name ${name ||
            'empty'} ${surname || 'empty'} successfuly created`,
          level: 'info',
          traceId: res.get('x-traceid'),
        })

        res.status(201).json(serializeUser(user))

        sendActivationEmail(user, res.get('x-traceid'))
      })
      .catch(err => {
        if (err.name === 'ValidationError') {
          logger.log({
            message: `Validation error ${err}`,
            level: 'error',
            traceId: res.get('x-traceid'),
          })
          res.status(400).json(err.errors)
        } else {
          next(err)

          logger.log({
            message: `Request error ${err}`,
            level: 'error',
            traceId: res.get('x-traceid'),
          })
        }
      })
  },
  authenticate(req: Request, res: Response, next: NextFunction): void {
    UserModel.findOne({ email: req.body.email, isBlocked: false })
      .then(async (user: IUser | null) => {
        if (!user) {
          logger.log({
            message: `Not existing user / or blocked tried to login (${req.body.email})`,
            level: 'info',
            traceId: res.get('x-traceid'),
          })
          res.status(401).json({
            message: 'Invalid email/password',
          })
          return
        }

        // check if account was activated
        if (user.isActive !== true) {
          logger.log({
            message: `Account ${req.body.email} is not yet activated, can not login`,
            level: 'info',
            traceId: res.get('x-traceid'),
          })
          res.status(403).json({
            message: 'Account is not active',
          })
          return
        }

        if (bcrypt.compareSync(req.body.password, user.password)) {
          authenticate(user, res.get('x-traceid'))
            .then(data => {
              if (data) {
                logger.log({
                  message: `User ${req.body.email} logged successfully`,
                  level: 'info',
                  traceId: res.get('x-traceid'),
                })
                // set cookies
                res
                  .status(201)
                  .header(
                    'Set-Cookie',
                    serializeCookie(
                      'accessToken',
                      data.accessToken,
                      config.get<number>('tokenLife')
                    )
                  )
                  .append(
                    'Set-Cookie',
                    serializeCookie(
                      'refreshToken',
                      data.refreshToken,
                      config.get<number>('refreshTokenLife')
                    )
                  )
                  .json(data)
                  .end()
              } else {
                res.status(500).end()
              }
            })
            .catch(() => res.status(500).end())
        } else {
          logger.log({
            message: `Invalid email or password (${req.body.email})`,
            level: 'info',
            traceId: res.get('x-traceid'),
          })
          res.status(401).json({
            message: 'Invalid email/password',
          })
        }
      })
      .catch((err: Error) => {
        next(err)
      })
  },
  refreshToken(req: Request, res: Response, next: NextFunction): void {
    RefreshTokenModel.findOne({
      token: req.body.token && req.body.token.trim(),
    })
      .populate('user')
      .then(async (token: IRefreshToken | null) => {
        if (!token || token.user === null) {
          res.status(401).json({ message: 'Token is invalid' })

          logger.log({
            message: `Someone tried to refresh token with invalid refreshToken (${req.body.token})`,
            level: 'warn',
            traceId: res.get('x-traceid'),
          })

          return
        }

        const newToken = jwt.sign(
          await getJWTData(token.user as IUser, res.get('x-traceid')),
          config.get<string>('secret'),
          {
            expiresIn: config.get<number>('tokenLife'),
          }
        )

        res
          .status(201)
          .header(
            'Set-Cookie',
            serializeCookie(
              'accessToken',
              newToken,
              config.get<number>('tokenLife')
            )
          )
          .json({
            accessToken: newToken,
          })

        logger.log({
          level: 'info',
          message: `Token was successfuly refresh using refreshToken ${req.body.token} for user ${token.user._id} (${token.user.email})`,
          traceId: res.get('x-traceid'),
        })
      })
      .catch((err: Error) => {
        next(err)
      })
  },
  getUser(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params

    UserModel.findById(id)
      .then(async (user: IUser | null) => {
        if (!user) {
          return res.status(404).end()
        }

        let groupsMember = user.groupsMember
        let groupsAdmin = user.groupsAdmin
        let groupsOwner = user.groupsOwner
        const groupsIds = arrayUnique([
          ...groupsMember,
          ...groupsAdmin,
          ...groupsOwner,
        ])

        if (groupsIds.length > 0) {
          try {
            const groups = arrayToHash(
              await findGroupsByIds(groupsIds, {
                traceId: res.get('x-traceid'),
              }),
              'id'
            )

            const mapGroupsFunc = (groupId: string) => {
              if (groups[groupId]) {
                return groups[groupId]
              }

              return null
            }
            const groupsFilterFunc = (group: IGroup | null) => group

            groupsMember = groupsMember
              .map(mapGroupsFunc)
              .filter(groupsFilterFunc)
            groupsAdmin = groupsAdmin
              .map(mapGroupsFunc)
              .filter(groupsFilterFunc)
            groupsOwner = groupsOwner
              .map(mapGroupsFunc)
              .filter(groupsFilterFunc)
          } catch (err) {
            logger.log({
              message: `Can not fetch group info ${err}`,
              level: 'error',
              traceId: res.get('x-traceid'),
            })

            return res.status(500).end()
          }
        }

        res.status(200).json({
          ...serializeUser(user),
          groupsMember,
          groupsAdmin,
          groupsOwner,
        })
      })
      .catch(err => {
        logger.log({
          message: `Database error ${err}`,
          level: 'error',
          traceId: res.get('x-traceid'),
        })

        next(err)
      })
  },
}
