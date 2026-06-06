// Mirrors WEBASE SelectListItem<int> (the items inside SelectList<int>).
import { ApiProperty } from '@nestjs/swagger';

export class SelectItemDto {
  @ApiProperty()
  value: number;

  @ApiProperty()
  text: string;
}
