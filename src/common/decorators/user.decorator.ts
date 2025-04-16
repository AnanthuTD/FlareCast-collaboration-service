import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export type UserType = { id: string };

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserType => {
    const request = ctx.switchToHttp().getRequest();
    console.log(request.headers);
    const userInfo = request.headers['x-user-info'];
    if (userInfo) {
      const user = JSON.parse(userInfo);
      return user;
    }

    new UnauthorizedException();
  },
);
