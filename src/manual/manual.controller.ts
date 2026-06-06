// Port of Zonic.Api/Controllers/ManualController.cs  →  routes under /Manual  ([Authorize] on whole controller)
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManualService } from './manual.service';
import { SelectItemDto } from './dto/select-item.dto';

@ApiTags('Manual')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Manual')
export class ManualController {
  constructor(private readonly manualService: ManualService) {}

  @Get('StateSelectList')
  @ApiOperation({ summary: 'State (enum_state) select list' })
  @ApiOkResponse({ type: SelectItemDto, isArray: true })
  stateSelectList(): Promise<SelectItemDto[]> {
    return this.manualService.stateSelectList();
  }

  @Get('CountrySelectList')
  @ApiOperation({ summary: 'Country select list' })
  @ApiOkResponse({ type: SelectItemDto, isArray: true })
  countrySelectList(): Promise<SelectItemDto[]> {
    return this.manualService.countrySelectList();
  }

  @Get('RegionSelectList')
  @ApiOperation({ summary: 'Region select list (optionally filtered by country)' })
  @ApiQuery({ name: 'countryId', required: false, type: Number })
  @ApiOkResponse({ type: SelectItemDto, isArray: true })
  regionSelectList(@Query('countryId') countryId?: string): Promise<SelectItemDto[]> {
    return this.manualService.regionSelectList(
      countryId != null && countryId !== '' ? Number(countryId) : null,
    );
  }

  @Get('DistrictSelectList')
  @ApiOperation({ summary: 'District select list (optionally filtered by region)' })
  @ApiQuery({ name: 'regionId', required: false, type: Number })
  @ApiOkResponse({ type: SelectItemDto, isArray: true })
  districtSelectList(@Query('regionId') regionId?: string): Promise<SelectItemDto[]> {
    return this.manualService.districtSelectList(
      regionId != null && regionId !== '' ? Number(regionId) : null,
    );
  }

  @Get('RunTypeSelectList')
  @ApiOperation({ summary: 'Run type (enum_run_type) select list' })
  @ApiOkResponse({ type: SelectItemDto, isArray: true })
  runTypeSelectList(): Promise<SelectItemDto[]> {
    return this.manualService.runTypeSelectList();
  }
}
