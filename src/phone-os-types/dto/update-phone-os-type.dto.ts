import { PartialType } from '@nestjs/swagger';
import { CreatePhoneOsTypeDto } from './create-phone-os-type.dto';

export class UpdatePhoneOsTypeDto extends PartialType(CreatePhoneOsTypeDto) { }
