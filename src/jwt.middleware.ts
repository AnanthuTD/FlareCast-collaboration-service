import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // this.logger.verbose('================ In jwt middleware =================');
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      // this.logger.verbose('No authorization header found');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      try {
        const decoded = jwt.verify(
          token,
          process.env.ACCESS_TOKEN_SECRET,
        ) as any;

        /*  this.logger.log('================================');
        this.logger.log('Decoded token:', decoded);
        this.logger.log('================================'); */

        req['user'] = decoded; // Attach user data to the request object
      } catch (err) {
        this.logger.verbose('JWT verification failed:', err.message);
      }
    }
    next();
  }
}
