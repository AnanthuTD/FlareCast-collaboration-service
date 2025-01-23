import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { logger } from './logger/logger';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    logger.info('================ In jwt middleware =================');
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      logger.error('No authorization header found');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      try {
        const decoded = jwt.verify(
          token,
          process.env.ACCESS_TOKEN_SECRET,
        ) as any;

        logger.info('================================');
        logger.info('Decoded token:', decoded);
        logger.info('================================');

        req['user'] = decoded; // Attach user data to the request object
      } catch (err) {
        logger.error('JWT verification failed:', err.message);
      }
    }
    next();
  }
}
