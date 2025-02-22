import { Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { Logger } from '@nestjs/common';

interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

// Middleware function for Socket.IO
export function AuthWsMiddleware() {
  const logger = new Logger('AuthWsMiddleware');

  return (socket: Socket, next: (err?: any) => void) => {
    // Extract token from handshake (e.g., from query or headers)
    const token = socket.handshake.auth.token || socket.handshake.query.token;

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

      // Attach the decoded payload to the socket for later use
      socket.data = { userId: decoded.userId };
      logger.log(`Client authenticated: ${decoded.userId}`);

      // Proceed to the next middleware or event handler
      next();
    } catch (error) {
      logger.error(`Authentication failed: ${error.message}`);
      return next(new Error('Authentication error: Invalid token'));
    }
  };
}
