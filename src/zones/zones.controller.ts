// Routes under /Zone ([Authorize]) — PostGIS polygon territories.
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ZonesService } from './zones.service';
import { ZoneAreaRequestDto } from './dto/zone-area-request.dto';
import { ZoneItemDto } from './dto/zone-item.dto';
import { ZoneDetailsDto } from './dto/zone-details.dto';

@ApiTags('Zone')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Zone')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get('GetArea')
  @ApiOperation({ summary: 'Polygon zones within a viewport (bounding box)' })
  @ApiOkResponse({ type: ZoneItemDto, isArray: true })
  getArea(@Query() request: ZoneAreaRequestDto): Promise<ZoneItemDto[]> {
    return this.zonesService.getArea(request);
  }

  @Get('GetMyZones')
  @ApiOperation({ summary: 'Polygon zones owned by the authenticated user' })
  @ApiOkResponse({ type: ZoneItemDto, isArray: true })
  getMyZones(@CurrentUser() user: AuthUser): Promise<ZoneItemDto[]> {
    return this.zonesService.getUserZones(user.userId);
  }

  @Get('Details/:id')
  @ApiOperation({ summary: 'Zone detail card (owner, avatar, area)' })
  @ApiOkResponse({ type: ZoneDetailsDto })
  getDetails(@Param('id') id: string): Promise<ZoneDetailsDto> {
    return this.zonesService.getDetails(id);
  }
}
