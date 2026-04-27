import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CalculatorService } from './calculator.service';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import {
  OsTypeResponseDto,
  PhoneCategoryResponseDto,
  ProblemCategoryResponseDto,
} from './dto/calculator-response.dto';

@ApiTags('Calculator')
@Controller('calculator')
export class CalculatorController {
  constructor(private readonly service: CalculatorService) {}

  @Get('os-types')
  @ApiOperation({
    summary: 'Get all active OS types',
    description:
      'Retrieves a list of all active operating system types (e.g., iOS, Android) for the calculator.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved active OS types.',
    type: [OsTypeResponseDto],
  })
  async getOsTypes(): Promise<OsTypeResponseDto[]> {
    return this.service.getOsTypes();
  }

  @Get('phone-categories/:os_type_id')
  @ApiOperation({
    summary: 'Get phone categories by OS type',
    description:
      'Retrieves a list of phone categories (models/series) associated with a specific OS type. Supports tree flow navigation via parent_id.',
  })
  @ApiParam({
    name: 'os_type_id',
    description: 'The UUID of the operating system type',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiQuery({
    name: 'parent_id',
    description: 'The UUID of the parent category (optional)',
    required: false,
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved phone categories.',
    type: [PhoneCategoryResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid UUID format.' })
  async getPhoneCategories(
    @Param('os_type_id', ParseUUIDPipe) osTypeId: string,
    @Query('parent_id', new ParseUUIDPipe({ isOptional: true })) parentId?: string,
  ): Promise<PhoneCategoryResponseDto[]> {
    return this.service.getPhoneCategories(osTypeId, parentId);
  }

  @Get('problem-categories/:phone_category_id')
  @ApiOperation({
    summary: 'Get problem categories by phone category',
    description:
      'Retrieves a list of potential problems and their costs for a specific phone category.',
  })
  @ApiParam({
    name: 'phone_category_id',
    description: 'The UUID of the phone category',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved problem categories with calculated costs.',
    type: [ProblemCategoryResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid UUID format.' })
  async getProblemCategories(
    @Param('phone_category_id', ParseUUIDPipe) phoneCategoryId: string,
  ): Promise<ProblemCategoryResponseDto[]> {
    return this.service.getProblemCategories(phoneCategoryId);
  }
}
