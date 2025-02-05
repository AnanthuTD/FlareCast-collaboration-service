import { Controller, Post, Body, Param, Query } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { User, UserType } from 'src/common/decorators/user.decorator';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@Controller('invitation')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post('accept')
  acceptInvitation(@Body('token') token: string) {
    return this.invitationService.accept(token);
  }

  @Post(':workspaceId')
  inviteMembers(
    @Param('workspaceId') workspaceId: string,
    @User() user: UserType,
    @Body() inviteMembersDto: CreateInvitationDto,
  ) {
    return this.invitationService.create(
      workspaceId,
      user.id,
      inviteMembersDto.invites,
    );
  }
}
