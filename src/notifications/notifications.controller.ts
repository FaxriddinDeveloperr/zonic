// Routes under /Notifications ([Authorize]).
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { NotificationsService } from './notifications.service';
import { MarkReadDto, NotificationsResponseDto, OkDto } from './dto/notifications.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "The caller's notifications (newest first) + unread count" })
  @ApiOkResponse({ type: NotificationsResponseDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query('Page') page = '1',
    @Query('PageSize') pageSize = '20',
  ): Promise<NotificationsResponseDto> {
    return this.notifications.list(
      user.userId,
      Math.max(1, Number(page) || 1),
      Math.max(1, Number(pageSize) || 20),
    );
  }

  @Post('MarkRead')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark given ids read, or ALL if ids omitted/empty' })
  @ApiOkResponse({ type: OkDto })
  markRead(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto): Promise<OkDto> {
    return this.notifications.markRead(user.userId, dto.ids);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one notification' })
  @ApiOkResponse({ type: OkDto })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OkDto> {
    return this.notifications.remove(user.userId, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all of the caller notifications' })
  @ApiOkResponse({ type: OkDto })
  removeAll(@CurrentUser() user: AuthUser): Promise<OkDto> {
    return this.notifications.removeAll(user.userId);
  }
}
