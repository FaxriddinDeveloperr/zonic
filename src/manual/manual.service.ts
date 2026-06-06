// Port of Zonic.ServiceLayer/ManualServices/ManualService.cs + the *SelectList query objects.
// AsSelectList(): Value = Id, Text = DisplayName/Fullname, OrderBy Ordercode (country/region/district).
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { State } from '../entities/state.entity';
import { Country } from '../entities/country.entity';
import { Region } from '../entities/region.entity';
import { District } from '../entities/district.entity';
import { RunType } from '../entities/run-type.entity';
import { SelectItemDto } from './dto/select-item.dto';

@Injectable()
export class ManualService {
  constructor(
    @InjectRepository(State) private readonly states: Repository<State>,
    @InjectRepository(Country) private readonly countries: Repository<Country>,
    @InjectRepository(Region) private readonly regions: Repository<Region>,
    @InjectRepository(District) private readonly districts: Repository<District>,
    @InjectRepository(RunType) private readonly runTypes: Repository<RunType>,
  ) {}

  async stateSelectList(): Promise<SelectItemDto[]> {
    const rows = await this.states.find();
    return rows.map((r) => ({ value: r.id, text: r.displayName }));
  }

  async countrySelectList(): Promise<SelectItemDto[]> {
    const rows = await this.countries.find({ order: { ordercode: 'ASC' } });
    return rows.map((r) => ({ value: r.id, text: r.fullname }));
  }

  async regionSelectList(countryId: number | null): Promise<SelectItemDto[]> {
    const rows = await this.regions.find({
      where: countryId != null ? { countryId } : {},
      order: { ordercode: 'ASC' },
    });
    return rows.map((r) => ({ value: r.id, text: r.fullname }));
  }

  async districtSelectList(regionId: number | null): Promise<SelectItemDto[]> {
    const rows = await this.districts.find({
      where: regionId != null ? { regionId } : {},
      order: { ordercode: 'ASC' },
    });
    return rows.map((r) => ({ value: r.id, text: r.fullname }));
  }

  async runTypeSelectList(): Promise<SelectItemDto[]> {
    const rows = await this.runTypes.find();
    return rows.map((r) => ({ value: r.id, text: r.displayName }));
  }
}
