// Mirrors Zonic.DataLayer/EFClasses/Info/District.cs  →  table info_district
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('info_district')
export class District {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'ordercode', type: 'varchar', nullable: true })
  ordercode: string | null;

  @Column({ name: 'fullname' })
  fullname: string;

  @Column({ name: 'regionid' })
  regionId: number;

  @Column({ name: 'stateid' })
  stateId: number;
}
