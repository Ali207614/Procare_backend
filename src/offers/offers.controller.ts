import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { OffersService } from './offers.service';
import { Offer } from '../common/types/offer.interface';
import { CreateOfferDto } from './dto/create-offer.dto';
import { FindAllOffersDto } from './dto/find-all-offers.dto';
import { PaginationResult } from '../common/utils/pagination.util';
import { JwtAdminAuthGuard } from '../common/guards/jwt-admin.guard';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SetPermissions } from '../common/decorators/permission-decorator';
import { PermissionsGuard } from '../common/guards/permission.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/types/user-payload.interface';
import { PermissionsService } from '../permissions/permissions.service';
import { OfferDto, PaginatedOffersDto } from './dto/offer.dto';
import { OfferPdfUrlDto } from './dto/offer-pdf-url.dto';

@ApiTags('Offers')
@ApiExtraModels(OfferDto, PaginatedOffersDto)
@Controller('offers')
export class OffersController {
  constructor(
    private readonly offersService: OffersService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @ApiOperation({ summary: 'Get offers (paginated for managers, latest active for others)' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Returns a paginated list of offers for managers, or the latest active offer for regular users.',
    type: PaginatedOffersDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('offers.view_all', 'offers.view')
  @Get()
  async findAll(
    @CurrentUser() user: UserPayload,
    @Query() findAllOffersDto: FindAllOffersDto,
  ): Promise<PaginationResult<Offer>> {
    const userPermissions = await this.permissionsService.getPermissions(user.id);
    if (userPermissions.includes('offers.view_all')) {
      return this.offersService.findAll(findAllOffersDto);
    }
    const offer = await this.offersService.findActive();
    return { rows: [offer], total: 1, limit: 1, offset: 0 };
  }

  @ApiOperation({ summary: 'Get current offer PDF URL' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Returns a temporary URL for the current active offer PDF.',
    type: OfferPdfUrlDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('offers.view')
  @Get('pdf-url')
  async getPdfUrl(): Promise<OfferPdfUrlDto> {
    return this.offersService.getPdfUrl();
  }

  @ApiOperation({ summary: 'Get a single offer by ID (history)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Offer ID (UUID)' })
  @ApiOkResponse({ description: 'The offer details', type: OfferDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('offers.view')
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Offer> {
    return this.offersService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new version of the offer (replaces current active one)' })
  @ApiCreatedResponse({ description: 'The offer has been successfully created.', type: OfferDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('offers.create', 'offers.update')
  @Post()
  async create(@Body() createOfferDto: CreateOfferDto): Promise<Offer> {
    return this.offersService.create(createOfferDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete an offer' })
  @ApiParam({ name: 'id', description: 'Offer ID (UUID)' })
  @ApiNoContentResponse({ description: 'The offer has been successfully deleted.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('offers.delete')
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.offersService.remove(id);
  }
}
