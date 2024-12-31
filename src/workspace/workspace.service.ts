import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService } from 'src/kafka/kafka.service';

@Injectable()
export class WorkspaceService implements OnModuleInit {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly kafkaService: KafkaService,
  ) {}

  /* listen to user-created topic and create a new personal workspace for every new user */
  async onModuleInit() {
    try {
      await this.kafkaService.subscribeToTopic(
        'user-events',
        async (message) => {
          if (message.key === 'user-created') {
            const { userId, firstName } = message.value;
            console.log(`User created: ${userId}`);

            // Create default workspace
            await this.databaseService.workSpace.create({
              data: {
                userId,
                name: `${firstName}'s Workspace`,
                type: 'PERSONAL',
              },
            });
          }
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to Kafka topic:', error.message);
    }
  }

  // Create a new workspace
  async create(createWorkspaceDto: Prisma.WorkSpaceCreateInput) {
    try {
      return await this.databaseService.workSpace.create({
        data: createWorkspaceDto,
      });
    } catch (error) {
      throw new Error(`Failed to create workspace: ${error.message}`);
    }
  }

  // Find all workspaces
  async findAll() {
    try {
      return await this.databaseService.workSpace.findMany();
    } catch (error) {
      throw new Error(`Failed to retrieve workspaces: ${error.message}`);
    }
  }

  async findByUser(userId: string) {
    try {
      const owned = await this.databaseService.workSpace.findMany({
        where: {
          userId,
        },
      });
      const member = await this.databaseService.workSpace.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
      });

      return { owned, member };
    } catch (error) {
      throw new Error(`Failed to retrieve workspaces: ${error.message}`);
    }
  }

  // Find a single workspace by ID
  async findOne(id: string) {
    try {
      const workspace = await this.databaseService.workSpace.findUnique({
        where: { id },
      });
      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }
      return workspace;
    } catch (error) {
      throw new Error(`Failed to retrieve workspace: ${error.message}`);
    }
  }

  // Update a workspace by ID
  async update(id: string, updateWorkspaceDto: Prisma.WorkSpaceUpdateInput) {
    try {
      const existingWorkspace = await this.databaseService.workSpace.findUnique(
        {
          where: { id },
        },
      );

      if (!existingWorkspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      return await this.databaseService.workSpace.update({
        where: { id },
        data: updateWorkspaceDto,
      });
    } catch (error) {
      throw new Error(`Failed to update workspace: ${error.message}`);
    }
  }

  // Remove a workspace by ID
  async remove(id: string) {
    try {
      const existingWorkspace = await this.databaseService.workSpace.findUnique(
        {
          where: { id },
        },
      );

      if (!existingWorkspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      return await this.databaseService.workSpace.delete({
        where: { id },
      });
    } catch (error) {
      throw new Error(`Failed to delete workspace: ${error.message}`);
    }
  }
}
