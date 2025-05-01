import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService } from 'src/kafka/kafka.service';
import { ValidationService } from 'src/common/validations/validations.service';

@Injectable()
export class SpaceService {
  private readonly logger = new Logger(SpaceService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly kafkaService: KafkaService,
    private readonly validationService: ValidationService,
  ) {}

  async create(createSpaceDto: CreateSpaceDto, userId: string) {
    this.logger.log(`Creating space: ${JSON.stringify(createSpaceDto)}`);

    // Validate workspace ID
    const workspace = await this.databaseService.workSpace.findUnique({
      where: { id: createSpaceDto.workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(
        `Workspace with ID ${createSpaceDto.workspaceId} not found`,
      );
    }

    // Create space
    const space = await this.databaseService.space.create({
      data: {
        name: createSpaceDto.name,
        type: createSpaceDto.type,
        workspaceId: createSpaceDto.workspaceId,
      },
    });

    const result = await this.databaseService.member.updateMany({
      where: {
        userId: {
          in: [...createSpaceDto.members, userId],
        },
        workspaceId: createSpaceDto.workspaceId,
      },
      data: {
        spaceIds: {
          push: space.id, // Use space.id as string
        },
      },
    });

    this.logger.debug('Results of raw: ' + JSON.stringify(result));

    return { space, result };
  }

  async findAll(workspaceId: string, userId: string) {
    this.logger.log(`Fetching all spaces`);
    return await this.databaseService.space.findMany({
      where: {
        workspaceId,
        memberIds: { has: userId },
      },
    });
  }

  async findOne(id: string) {
    this.logger.log(`Fetching space with ID: ${id}`);

    const space = await this.databaseService.space.findUnique({
      where: { id },
    });

    if (!space) {
      throw new NotFoundException(`Space with ID ${id} not found`);
    }

    return space;
  }

  async update(id: string, updateSpaceDto: UpdateSpaceDto) {
    this.logger.log(
      `Updating space ${id} with data: ${JSON.stringify(updateSpaceDto)}`,
    );

    // Check if space exists
    const spaceExists = await this.databaseService.space.findUnique({
      where: { id },
    });

    if (!spaceExists) {
      throw new NotFoundException(`Space with ID ${id} not found`);
    }

    // Update space
    const updatedSpace = await this.databaseService.space.update({
      where: { id },
      data: {
        name: updateSpaceDto.name,
        type: updateSpaceDto.type,
      },
    });

    // Publish event to Kafka
    // await this.kafkaService.sendMessageToTopic('space.updated', { spaceId: id });

    return updatedSpace;
  }

  async remove(id: string) {
    this.logger.log(`Deleting space with ID: ${id}`);

    // Check if space exists
    const spaceExists = await this.databaseService.space.findUnique({
      where: { id },
    });

    if (!spaceExists) {
      throw new NotFoundException(`Space with ID ${id} not found`);
    }

    // Delete space
    await this.databaseService.space.delete({ where: { id } });

    // Publish event to Kafka
    // await this.kafkaService.sendMessageToTopic('space.deleted', { spaceId: id });

    return { message: `Space ${id} deleted successfully` };
  }

  async getSpaceMembers(spaceId: string) {
    const space = await this.databaseService.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      throw new NotFoundException(`Space with ID ${spaceId} not found`);
    }

    const members = await this.databaseService.member.findMany({
      where: { spaceIds: { has: spaceId } },
      select: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        id: true,
        role: true,
      },
    });

    const transformedMembers = members.map((member) => ({
      id: member.id,
      role: member.role,
      name: member.User.name,
      userId: member.User.id,
    }));

    return { members: transformedMembers };
  }

  async addMemberToSpace(spaceId: string, userId: string, memberId: string) {
    // Check if space exists and get workspaceId
    const spaceExists = await this.databaseService.space.findUnique({
      where: { id: spaceId },
      select: { workspaceId: true },
    });

    if (!spaceExists) {
      throw new NotFoundException(`Space with ID ${spaceId} not found`);
    }

    // Verify user is an admin in the workspace
    const adminUser = await this.databaseService.member.findFirst({
      where: {
        userId,
        workspaceId: spaceExists.workspaceId,
        role: 'ADMIN',
      },
      select: { id: true },
    });

    if (!adminUser) {
      throw new NotFoundException(
        `User with ID ${userId} does not have admin privileges in this workspace`,
      );
    }

    // Check if member exists in the workspace
    const existingMember = await this.databaseService.member.findFirst({
      where: {
        userId: memberId,
        workspaceId: spaceExists.workspaceId,
      },
      select: { id: true, spaceIds: true },
    });

    if (!existingMember) {
      throw new BadRequestException(
        `User with ID ${memberId} does not exist in this workspace. Add the user to the workspace before adding to the space.`,
      );
    }

    // Avoid duplicate spaceId in spaceIds array
    if (existingMember.spaceIds.includes(spaceId)) {
      return;
    }

    // Update member's spaceIds
    const updatedMember = await this.databaseService.member.update({
      where: { id: existingMember.id },
      data: {
        spaceIds: {
          push: spaceId,
        },
      },
    });

    return updatedMember;
  }

  async removeMemberFromSpace(
    spaceId: string,
    userId: string,
    memberId: string,
  ) {
    // Check if space exists and get workspaceId
    const spaceExists = await this.databaseService.space.findUnique({
      where: { id: spaceId },
      select: {
        workspaceId: true,
        Workspace: {
          select: {
            owner: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!spaceExists) {
      throw new NotFoundException(`Space with ID ${spaceId} not found`);
    }

    // Verify user is an admin in the workspace
    const adminUser = await this.databaseService.member.findFirst({
      where: {
        userId,
        workspaceId: spaceExists.workspaceId,
        role: 'ADMIN',
      },
      select: { id: true },
    });

    if (!adminUser) {
      throw new NotFoundException(
        `User with ID ${userId} does not have admin privileges in this workspace`,
      );
    }

    // Check if member exists in the workspace and space
    const existingMember = await this.databaseService.member.findFirst({
      where: {
        id: memberId,
        workspaceId: spaceExists.workspaceId,
      },
      select: { id: true, spaceIds: true, userId: true },
    });

    if (!existingMember) {
      throw new BadRequestException(
        `User with ID ${memberId} does not exist in this workspace.`,
      );
    }

    if (spaceExists.Workspace.owner.id === existingMember.userId) {
      throw new ForbiddenException(
        'Cannot remove the workspace owner from the space.',
      );
    }

    // Check if member is in the space
    if (!existingMember.spaceIds.includes(spaceId)) {
      return; // Member isn’t in the space, no action needed
    }

    // Remove spaceId from member's spaceIds
    const updatedMember = await this.databaseService.member.update({
      where: { id: existingMember.id },
      data: {
        spaceIds: {
          set: existingMember.spaceIds.filter((id) => id !== spaceId),
        },
      },
    });

    return updatedMember;
  }
}
