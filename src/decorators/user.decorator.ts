import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type UserType = { id: string };

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserType => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as UserType;
  },
);
