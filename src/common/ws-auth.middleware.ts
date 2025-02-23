import { Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { Logger } from '@nestjs/common';

interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export function AuthWsMiddleware() {
  const logger = new Logger('AuthWsMiddleware');

  return (socket: Socket, next: (err?: any) => void) => {
    // Log handshake details for debugging
    logger.log('cookies: ' + socket.handshake.headers.cookie);
    logger.log('Handshake auth:', socket.handshake.auth);

    // Extract token from handshake.auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      logger.warn('No token provided in WebSocket handshake');
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      // Verify the JWT token
      const decoded = verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
      ) as JwtPayload;

      // Store the decoded user data in socket.data
      socket.data = { user: decoded };
      logger.log(`Client authenticated: ${JSON.stringify(decoded)}`);

      // Proceed to the next middleware or event handler
      next();
    } catch (error) {
      logger.error(`Authentication failed: ${error.message}`);
      return next(new Error('Authentication error: Invalid token'));
    }
  };
}
