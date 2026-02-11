import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PhoneOsTypesService } from './phone-os-types.service';
import { CreatePhoneOsTypeDto } from './dto/create-phone-os-type.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { UpdatePhoneOsTypeDto } from './dto/update-phone-os-type.dto';
import { PhoneOsType } from 'src/common/types/phone-os-type.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';
import { FindAllPhoneOsTypeDto } from './dto/find-all-phone-os-type.dto';

@ApiTags('Phone OS Types')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('phone-os-types')
export class PhoneOsTypesController {
  constructor(private readonly service: PhoneOsTypesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone.os.create')
  @ApiOperation({ summary: 'Create new phone OS type' })
  @ApiResponse({ status: 201, description: 'Phone OS type created successfully' })
  async create(
    @CurrentAdmin() admin: AdminPayload,
    @Body() dto: CreatePhoneOsTypeDto,
  ): Promise<PhoneOsType> {
    return this.service.create(dto, admin.id);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @UseInterceptors(PaginationInterceptor)
  @SetPermissions('phone.os.view')
  @ApiOperation({ summary: 'Get all phone OS types (from Redis or DB)' })
  async findAll(@Query() query: FindAllPhoneOsTypeDto): Promise<PaginationResult<PhoneOsType>> {
    return this.service.findAll(query);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone.os.update')
  @ApiOperation({ summary: 'Update phone OS type' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePhoneOsTypeDto,
  ): Promise<{ message: string }> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone.os.delete')
  @ApiOperation({ summary: 'Soft delete phone OS type' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.service.delete(id);
  }
}
