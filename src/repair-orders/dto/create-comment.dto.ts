import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Manual comment text written by the authenticated admin.',
    example: 'Customer asked to confirm the screen replacement price before repair starts.',
    maxLength: 1000,
  })
  @IsString({ context: { location: 'text' } })
  @MaxLength(1000, { context: { location: 'text' } })
  text!: string;
}
