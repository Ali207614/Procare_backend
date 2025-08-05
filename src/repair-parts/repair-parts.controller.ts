import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { RepairPartsService } from 'src/repair-parts/repair-parts.service';
import { CreateRepairPartDto } from 'src/repair-parts/dto/create-repair-part.dto';
import { RepairPart } from 'src/common/types/repair-part.interface';
import { UpdateRepairPartDto } from 'src/repair-parts/dto/update-repair-part.dto';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { AssignRepairPartsToCategoryDto } from 'src/repair-parts/dto/assign-repair-parts.dto';

@ApiTags('Repair parts')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-parts')
export class RepairPartsController {
  constructor(private readonly repairPartsService: RepairPartsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair_part.create')
  @ApiOperation({ summary: 'Create a new repair part' })
  @ApiResponse({ status: 201, description: 'Repair part successfully created' })
  @ApiResponse({ status: 400, description: 'Validation failed or part already exists' })
  async create(
    @Body() createRepairPartDto: CreateRepairPartDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<RepairPart> {
    return this.repairPartsService.create(createRepairPartDto, req.admin.id);
  }

  @Put('assignments')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair_part.assign_problem')
  @ApiOperation({ summary: 'Assign or update repair parts for a problem category' })
  @ApiResponse({ status: 200, description: 'Repair part assignments successfully updated' })
  @ApiResponse({ status: 400, description: 'Validation failed or part IDs are invalid' })
  async updateAssignments(
    @Body() dto: AssignRepairPartsToCategoryDto,
  ): Promise<{ message: string }> {
    await this.repairPartsService.assignRepairPartsToProblemCategory(dto);
    return { message: 'Repair part assignments updated successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Get all repair parts' })
  @ApiResponse({ status: 200, description: 'List of all repair parts' })
  async findAll(): Promise<RepairPart[]> {
    return this.repairPartsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single repair part by ID' })
  @ApiResponse({ status: 200, description: 'Repair part found' })
  @ApiResponse({ status: 404, description: 'Repair part not found' })
  async findOne(@Param('id') id: string): Promise<RepairPart> {
    return this.repairPartsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair_part.update')
  @ApiOperation({ summary: 'Update an existing repair part' })
  @ApiResponse({ status: 200, description: 'Repair part successfully updated' })
  @ApiResponse({ status: 400, description: 'Validation failed or part name is duplicated' })
  @ApiResponse({ status: 404, description: 'Repair part not found' })
  async update(
    @Param('id') id: string,
    @Body() updateRepairPartDto: UpdateRepairPartDto,
  ): Promise<{ message: string }> {
    return this.repairPartsService.update(id, updateRepairPartDto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair_part.delete')
  @ApiOperation({ summary: 'Delete a repair part by ID' })
  @ApiResponse({ status: 200, description: 'Repair part successfully deleted (soft delete)' })
  @ApiResponse({ status: 404, description: 'Repair part not found' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.repairPartsService.delete(id);
  }
}
