// DELETE /User/Me body — password confirmation (store requirement, BACKEND_TODO §6).
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteMeDto {
  @ApiProperty({ description: 'Current password, required to confirm account deletion' })
  @IsString()
  password: string;
}
