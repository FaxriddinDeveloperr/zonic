// Mirrors Zonic.DataLayer/EFClasses/Enum/RunType.cs  →  table enum_run_type
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('enum_run_type')
export class RunType {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'displayname' })
  displayName: string;
}
