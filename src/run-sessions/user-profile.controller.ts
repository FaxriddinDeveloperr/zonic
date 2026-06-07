// Port of Zonic.Api/Controllers/UserProfileController.cs  →  routes under /UserProfile  ([Authorize])
import {
  Controller,
  Get,
  HttpCode,
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
import { RunSessionService } from './run-session.service';
import { ProfileService, UploadedImage } from '../profile/profile.service';
import { RunHistoryRequestDto } from './dto/run-history-request.dto';
import { LeaderboardRequestDto } from './dto/leaderboard-request.dto';
import { RunHistoryResponseDto } from './dto/run-history-response.dto';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { MeDto, UploadAvatarResponseDto } from '../profile/dto/me.dto';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

@ApiTags('UserProfile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('UserProfile')
export class UserProfileController {
  constructor(
    private readonly runSessionService: RunSessionService,
    private readonly profileService: ProfileService,
  ) {}

  @Get('GetMe')
  @ApiOperation({ summary: 'Profile of the authenticated user' })
  @ApiOkResponse({ type: MeDto })
  getMe(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.profileService.getMe(user.userId);
  }

  @Post('UploadAvatar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Upload a profile image (multipart form field "file")' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOkResponse({ type: UploadAvatarResponseDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES } }))
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedImage,
  ): Promise<{ fileId: string }> {
    return this.profileService.saveAvatar(user.userId, file);
  }

  @Get('DownloadAvatar')
  @ApiOperation({ summary: 'Stream a profile image by fileId' })
  @ApiQuery({ name: 'fileId', required: true })
  downloadAvatar(@Query('fileId') fileId: string): StreamableFile {
    const { stream, contentType } = this.profileService.openAvatar(fileId);
    return new StreamableFile(stream, { type: contentType });
  }

  @Get('GetRunHistory')
  @ApiOperation({ summary: 'Run history with aggregate summary for the authenticated user' })
  @ApiOkResponse({ type: RunHistoryResponseDto })
  getRunHistory(
    @CurrentUser() user: AuthUser,
    @Query() request: RunHistoryRequestDto,
  ): Promise<RunHistoryResponseDto> {
    return this.runSessionService.getRunHistory(user.userId, request);
  }

  @Get('GetLeaderboard')
  @ApiOperation({ summary: 'Paginated leaderboard ranked by total distance' })
  @ApiOkResponse({ type: LeaderboardResponseDto })
  getLeaderboard(@Query() request: LeaderboardRequestDto): Promise<LeaderboardResponseDto> {
    return this.runSessionService.getLeaderboard(request);
  }
}
