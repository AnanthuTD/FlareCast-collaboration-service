import { Injectable } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ChatsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createChatDto) {
    try {
      console.log('receivedData: ', createChatDto);
      const { message, userId, videoId, repliedTo } = createChatDto;

      const chat = await this.databaseService.chat.create({
        data: {
          message,
          userId,
          videoId,
          repliedTo: repliedTo ? repliedTo.id : undefined,
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
            },
          },
          ParentChat: {
            select: {
              id: true,
              message: true,
              createdAt: true,
              User: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (chat) {
        chat.user = chat.User;
        chat.User = undefined;
        if (chat.ParentChat) {
          chat.repliedTo = chat.ParentChat;
          chat.ParentChat = undefined;
          chat.repliedTo.user = chat.repliedTo.User;
          chat.repliedTo.User = undefined;
        }
      }

      console.log('created chat: ', chat);

      return chat;
    } catch (error) {
      console.error(error);
      return;
    }
  }

  async findAll({
    videoId,
    cursor,
    limit = 10,
  }: {
    videoId: string;
    cursor: string | null;
    limit: number;
  }) {
    console.log(cursor);

    const chats = await this.databaseService.chat.aggregateRaw({
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                cursor
                  ? {
                      $lt: [
                        '$createdAt', // Assuming this is the correct field
                        {
                          $dateFromString: {
                            dateString: cursor,
                          },
                        },
                      ],
                    }
                  : true,
                {
                  videoId: { $oid: videoId },
                },
              ],
            },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: 'User',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $lookup: {
            from: 'Chat',
            localField: 'repliedTo',
            foreignField: '_id',
            as: 'repliedTo',
          },
        },
        {
          $unwind: { path: '$repliedTo', preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: 'User',
            localField: 'repliedTo.userId',
            foreignField: '_id',
            as: 'repliedTo.user',
          },
        },
        {
          $unwind: {
            path: '$repliedTo.user',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            id: { $toString: '$_id' },
            message: 1,
            createdAt: {
              $dateToString: {
                format: '%Y-%m-%dT%H:%M:%S.%LZ',
                date: '$createdAt',
              },
            },
            user: {
              id: { $toString: '$user._id' },
              name: '$user.name',
            },
            repliedTo: {
              $cond: {
                if: { $ifNull: ['$repliedTo._id', false] }, // Better null check
                then: {
                  id: { $toString: '$repliedTo._id' },
                  message: '$repliedTo.message',
                  createdAt: {
                    $dateToString: {
                      format: '%Y-%m-%dT%H:%M:%S.%LZ',
                      date: '$repliedTo.createdAt',
                    },
                  },
                  user: {
                    id: { $toString: '$repliedTo.user._id' },
                    name: '$repliedTo.user.name',
                  },
                },
                else: null,
              },
            },
          },
        },
      ],
    });

    console.log('chats: ' + JSON.stringify(chats, null, 2));

    return {
      nextCursor: chats.length ? chats[chats.length - 1]?.createdAt : null, // Use last item for proper pagination
      chats: chats.reverse(),
    };
  }

  async findOne(id: string) {
    return await this.databaseService.chat.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateChatDto: UpdateChatDto) {
    const chat = await this.databaseService.chat.update({
      where: { id },
      data: {
        message: updateChatDto.message,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        ParentChat: {
          select: {
            id: true,
            message: true,
            createdAt: true,
            User: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (chat) {
      chat.user = chat.User;
      chat.User = undefined;
      if (chat.ParentChat) {
        chat.repliedTo = chat.ParentChat;
        chat.ParentChat = undefined;
        chat.repliedTo.user = chat.repliedTo.User;
        chat.repliedTo.User = undefined;
      }
    }

    return chat;
  }

  async remove(id: string) {
    return await this.databaseService.chat.delete({
      where: { id },
    });
  }
}
