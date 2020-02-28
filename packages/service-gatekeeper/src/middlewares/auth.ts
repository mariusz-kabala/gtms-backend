import { NextFunction, Request, Response } from 'express'
import createError from 'http-errors'
import jwt from 'jsonwebtoken'
import logger from '@gtms/lib-logger'

const { SECRET } = process.env

export default (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-access-token']

  if (!token) {
    logger.log({
      level: 'info',
      message: 'No token in header, access denied',
      traceId: res.get('x-traceid'),
    })
    return next(createError(401, 'Access token is invalid'))
  }

  jwt.verify(token as string, SECRET, (err: Error, decoded: any) => {
    if (err) {
      logger.log({
        level: 'info',
        message: `Token in headers present, but token verification failed, access denied (${err})`,
        traceId: res.get('x-traceid'),
      })
      return next(createError(401, 'Access token is invalid'))
    }

    req.headers['x-access-token'] = JSON.stringify(decoded)

    next()
  })
}