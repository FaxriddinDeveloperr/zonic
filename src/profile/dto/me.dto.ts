import { ApiProperty } from '@nestjs/swagger';

export class MeDto {
  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'john@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: '+998901234567', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'a1b2c3d4.jpg', nullable: true })
  avatarFileId: string | null;

  @ApiProperty({ example: '#FF0000', nullable: true, description: 'Personal/team zone color' })
  color: string | null;
}

export class UploadAvatarResponseDto {
  @ApiProperty({ example: 'a1b2c3d4.jpg' })
  fileId: string;
}
