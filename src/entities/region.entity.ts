// Mirrors Zonic.DataLayer/EFClasses/Info/Region.cs  →  table info_region
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('info_region')
export class Region {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'ordercode', type: 'varchar', nullable: true })
  ordercode: string | null;

  @Column({ name: 'fullname' })
  fullname: string;

  @Column({ name: 'countryid' })
  countryId: number;

  @Column({ name: 'stateid' })
  stateId: number;
}
