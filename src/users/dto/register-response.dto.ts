// Mirrors RegisterResponseDto / HaveId<Guid>
import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
