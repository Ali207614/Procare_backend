import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PhoneProblemMappingsService } from './phone-problem-mappings.service';
import { CreatePhoneProblemMappingDto } from './dto/create-phone-problem-mapping.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';

@ApiTags('Phone Problem Mappings')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('phone-problem-mappings')
export class PhoneProblemMappingsController {
  constructor(private readonly service: PhoneProblemMappingsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone-problem-mapping.create')
  @ApiOperation({ summary: 'Link a problem to a phone category' })
  @ApiResponse({ status: 201, description: 'Mapping created successfully' })
  async create(@Body() dto: CreatePhoneProblemMappingDto) {
    return this.service.create(dto.phone_category_id, dto.problem_category_id);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone-problem-mapping.delete')
  @ApiOperation({ summary: 'Unlink a problem from a phone category' })
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
