import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { RepairPartsService } from 'src/repair-parts/repair-parts.service';
import { CreateRepairPartDto } from 'src/repair-parts/dto/create-repair-part.dto';
import { RepairPart } from 'src/common/types/repair-part.interface';
import { UpdateRepairPartDto } from 'src/repair-parts/dto/update-repair-part.dto'; // Assuming you have JWT auth

@ApiTags('repair-parts')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-parts')
export class RepairPartsController {
  constructor(private readonly repairPartsService: RepairPartsService) {}

  @Post()
  async create(
    @Body() createRepairPartDto: CreateRepairPartDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<RepairPart> {
    return this.repairPartsService.create(createRepairPartDto, req.admin.id);
  }

  @Get()
  async findAll(): Promise<RepairPart[]> {
    return this.repairPartsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<RepairPart> {
    return this.repairPartsService.findOne(id);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards()
  async update(
    @Param('id') id: string,
    @Body() updateRepairPartDto: UpdateRepairPartDto,
  ): Promise<{ message: string }> {
    return this.repairPartsService.update(id, updateRepairPartDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.repairPartsService.delete(id);
  }
}
