// Routes under /Feed ([Authorize] except image download is also auth here for simplicity).
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { UploadedImage } from '../profile/profile.service';
import { FeedService } from './feed.service';
import {
  CreatePostDto,
  CreateStoryDto,
  FeedOkDto,
  FeedResponseDto,
  PostDto,
  StoriesResponseDto,
  StoryDto,
  UploadImageResponseDto,
} from './dto/feed.dto';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

@ApiTags('Feed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Post('UploadImage')
  @HttpCode(200)
  @ApiOperation({ summary: 'Upload a feed/story image (multipart field "file"); returns fileId' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ type: UploadImageResponseDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  upload(@UploadedFile() file: UploadedImage): UploadImageResponseDto {
    return this.feed.saveImage(file);
  }

  @Get('Image')
  @ApiOperation({ summary: 'Stream a feed image by fileId' })
  @ApiQuery({ name: 'fileId', required: true })
  image(@Query('fileId') fileId: string): StreamableFile {
    const { stream, contentType } = this.feed.openImage(fileId);
    return new StreamableFile(stream, { type: contentType });
  }

  @Post('CreatePost')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a post (image count limited by tier)' })
  @ApiOkResponse({ type: PostDto })
  createPost(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto): Promise<PostDto> {
    return this.feed.createPost(user.userId, dto.caption, dto.type, dto.imageFileIds);
  }

  @Get('Posts')
  @ApiOperation({ summary: "Feed of the caller's and friends' posts" })
  @ApiOkResponse({ type: FeedResponseDto })
  posts(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<FeedResponseDto> {
    return this.feed.feed(user.userId, Math.max(1, Number(page) || 1), Math.max(1, Number(pageSize) || 20));
  }

  @Post('Posts/:id/Like')
  @HttpCode(200)
  @ApiOperation({ summary: 'Like a post' })
  @ApiOkResponse({ type: FeedOkDto })
  likePost(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<FeedOkDto> {
    return this.feed.like(user.userId, id);
  }

  @Delete('Posts/:id/Like')
  @ApiOperation({ summary: 'Remove a like' })
  @ApiOkResponse({ type: FeedOkDto })
  unlikePost(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<FeedOkDto> {
    return this.feed.unlike(user.userId, id);
  }

  @Post('CreateStory')
  @HttpCode(200)
  @ApiOperation({ summary: 'Post a 24h story (tier-gated count)' })
  @ApiOkResponse({ type: StoryDto })
  createStory(@CurrentUser() user: AuthUser, @Body() dto: CreateStoryDto): Promise<StoryDto> {
    return this.feed.createStory(user.userId, dto.fileId);
  }

  @Get('Stories')
  @ApiOperation({ summary: "Active stories from the caller and friends" })
  @ApiOkResponse({ type: StoriesResponseDto })
  storiesFeed(@CurrentUser() user: AuthUser): Promise<StoriesResponseDto> {
    return this.feed.stories(user.userId);
  }
}
