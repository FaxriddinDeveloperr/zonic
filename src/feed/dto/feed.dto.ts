// Social feed DTOs (Phase N).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiPropertyOptional({ example: 'Morning 5K 🏃', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @ApiPropertyOptional({ example: 'photo', enum: ['photo', 'run'] })
  @IsOptional()
  @IsIn(['photo', 'run'])
  type?: string;

  @ApiProperty({ type: [String], description: 'fileIds from /Feed/UploadImage (tier-limited count)' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  imageFileIds: string[];
}

export class CreateStoryDto {
  @ApiProperty({ example: 'a1b2c3.jpg', description: 'fileId from /Feed/UploadImage' })
  @IsString()
  fileId: string;
}

export class UploadImageResponseDto {
  @ApiProperty({ example: 'a1b2c3.jpg' })
  fileId: string;
}

export class AuthorDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  avatarFileId: string | null;
}

export class PostDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: AuthorDto })
  author: AuthorDto;

  @ApiProperty({ example: 'photo' })
  type: string;

  @ApiProperty({ nullable: true })
  caption: string | null;

  @ApiProperty({ type: [String], description: 'Image download URLs' })
  imageUrls: string[];

  @ApiProperty({ example: 3 })
  likeCount: number;

  @ApiProperty({ example: true })
  likedByMe: boolean;

  @ApiProperty({ example: '2026-06-30T10:00:00.000Z' })
  createdAt: string;
}

export class FeedResponseDto {
  @ApiProperty({ type: [PostDto] })
  items: PostDto[];
}

export class StoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: AuthorDto })
  author: AuthorDto;

  @ApiProperty({ example: '/Feed/Image?fileId=a1b2c3.jpg' })
  imageUrl: string;

  @ApiProperty({ example: '2026-06-30T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-07-01T10:00:00.000Z' })
  expiresAt: string;
}

export class StoriesResponseDto {
  @ApiProperty({ type: [StoryDto] })
  items: StoryDto[];
}

export class FeedOkDto {
  @ApiProperty({ example: true })
  ok: boolean;
}
