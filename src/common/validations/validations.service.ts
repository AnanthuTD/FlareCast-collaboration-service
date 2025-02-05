import { Injectable, BadRequestException } from '@nestjs/common';
import { EmailSchema } from './email.schema';

@Injectable()
export class ValidationService {
  private schemas = {
    email: EmailSchema,
  };

  validate<T>(schemaName: keyof typeof this.schemas, data: T) {
    const schema = this.schemas[schemaName];

    if (!schema) {
      throw new Error(`Schema ${schemaName} not found`);
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException(result.error.format());
    }

    return result.data; // Return validated data
  }
}
