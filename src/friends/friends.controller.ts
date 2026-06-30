// Routes under /Friends ([Authorize]).
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { FriendsService } from './friends.service';
import {
  FriendRequestDto,
  FriendRequestsDto,
  FriendsListDto,
  MyIdDto,
  OkDto,
  RespondRequestDto,
  SearchRequestDto,
  UserSummaryDto,
} from './dto/friends.dto';

@ApiTags('Friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Friends')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get('Me')
  @ApiOperation({ summary: 'Your ZONIC-ID and public card (assigned on first call)' })
  @ApiOkResponse({ type: MyIdDto })
  meCard(@CurrentUser() user: AuthUser): Promise<MyIdDto> {
    return this.friends.me(user.userId);
  }

  @Get('Search')
  @ApiOperation({ summary: 'Find a user by ZONIC-ID' })
  @ApiOkResponse({ type: UserSummaryDto })
  search(@Query() q: SearchRequestDto): Promise<UserSummaryDto> {
    return this.friends.search(q.zonicId);
  }

  @Post('Request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a friend request by ZONIC-ID' })
  @ApiOkResponse({ type: OkDto })
  request(@CurrentUser() user: AuthUser, @Body() dto: FriendRequestDto): Promise<OkDto> {
    return this.friends.sendRequest(user.userId, dto.zonicId);
  }

  @Post('Respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept or reject an incoming friend request' })
  @ApiOkResponse({ type: OkDto })
  respond(@CurrentUser() user: AuthUser, @Body() dto: RespondRequestDto): Promise<OkDto> {
    return this.friends.respond(user.userId, dto.requestId, dto.accept);
  }

  @Get('List')
  @ApiOperation({ summary: 'Accepted friends with last activity (Active Friends Bar source)' })
  @ApiOkResponse({ type: FriendsListDto })
  list(@CurrentUser() user: AuthUser): Promise<FriendsListDto> {
    return this.friends.list(user.userId);
  }

  @Get('Requests')
  @ApiOperation({ summary: 'Incoming pending friend requests' })
  @ApiOkResponse({ type: FriendRequestsDto })
  requests(@CurrentUser() user: AuthUser): Promise<FriendRequestsDto> {
    return this.friends.incomingRequests(user.userId);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a friend (unfriend)' })
  @ApiOkResponse({ type: OkDto })
  unfriend(@CurrentUser() user: AuthUser, @Param('userId') otherUserId: string): Promise<OkDto> {
    return this.friends.unfriend(user.userId, otherUserId);
  }
}
