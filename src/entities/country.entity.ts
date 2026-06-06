// Mirrors Zonic.DataLayer/EFClasses/Info/Country.cs  →  table info_country
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('info_country')
export class Country {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'ordercode', type: 'varchar', nullable: true })
  ordercode: string | null;

  @Column({ name: 'fullname' })
  fullname: string;

  @Column({ name: 'stateid' })
  stateId: number;
}
