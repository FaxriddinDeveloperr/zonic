// Mirrors Zonic.DataLayer/EFClasses/Enum/State.cs  →  table enum_state
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('enum_state')
export class State {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'displayname' })
  displayName: string;
}
