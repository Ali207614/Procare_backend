import { PartialType } from '@nestjs/swagger';
import { CreateTemplateDto } from 'src/templates/dto/create-template.dto';

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
