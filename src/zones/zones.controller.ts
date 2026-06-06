// Port of Zonic.Api/Controllers/ZoneController.cs  →  routes under /Zone  ([Authorize])
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ZonesService } from './zones.service';
import { ZoneAreaRequestDto } from './dto/zone-area-request.dto';
import { ZoneDto } from './dto/zone.dto';

@ApiTags('Zone')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Zone')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get('GetArea')
  @ApiOperation({ summary: 'List captured zones within a viewport (bounding box)' })
  @ApiOkResponse({ type: ZoneDto, isArray: true })
  getArea(@Query() request: ZoneAreaRequestDto): Promise<ZoneDto[]> {
    return this.zonesService.getArea(request);
  }

  @Get('GetMyZones')
  @ApiOperation({ summary: 'List zones currently owned by the authenticated user' })
  @ApiOkResponse({ type: ZoneDto, isArray: true })
  getMyZones(@CurrentUser() user: AuthUser): Promise<ZoneDto[]> {
    return this.zonesService.getUserZones(user.userId);
  }
}
