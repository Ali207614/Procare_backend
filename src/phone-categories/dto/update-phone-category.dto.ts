import { PartialType } from '@nestjs/swagger';
import { CreatePhoneCategoryDto } from './create-phone-category.dto';

export class UpdatePhoneCategoryDto extends PartialType(CreatePhoneCategoryDto) { }
