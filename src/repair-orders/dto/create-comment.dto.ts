import { IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
    @IsString({ context: { location: 'text' } })
    @MaxLength(1000, { context: { location: 'text' } })
    text: string;
}
