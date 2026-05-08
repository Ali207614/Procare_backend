import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { HistoryLineageQueryDto, HistoryPaginationDto } from './dto/history-query.dto';
import { SearchHistoryValuesDto } from './dto/search-history-values.dto';
import { HistoryService } from './history.service';

@ApiTags('History')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard, PermissionsGuard)
@SetPermissions('history.view')
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('values/search')
  @ApiOperation({ summary: 'Search current tracked values by exact hash or text contains' })
  searchCurrentValues(
    @Query() query: SearchHistoryValuesDto,
  ): ReturnType<HistoryService['searchCurrentValues']> {
    return this.historyService.searchCurrentValues(query);
  }

  @Get('values/:current_value_id/lineage')
  @ApiOperation({ summary: 'Explain the lineage graph for one current value' })
  @ApiParam({ name: 'current_value_id', description: 'history_current_values ID' })
  getValueLineage(
    @Param('current_value_id', ParseUUIDPipe) currentValueId: string,
    @Query() query: HistoryLineageQueryDto,
  ): ReturnType<HistoryService['getValueLineage']> {
    return this.historyService.getValueLineage(currentValueId, query.depth);
  }

  @Get('entities/:table/:id/timeline')
  @ApiOperation({ summary: 'Get a timeline for one audited entity' })
  @ApiParam({ name: 'table', description: 'Entity table name' })
  @ApiParam({ name: 'id', description: 'Entity primary key as text' })
  getEntityTimeline(
    @Param('table') table: string,
    @Param('id') id: string,
    @Query() query: HistoryPaginationDto,
  ): ReturnType<HistoryService['getEntityTimeline']> {
    return this.historyService.getEntityTimeline({
      entity_table: table,
      entity_pk: id,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('events/:event_id')
  @ApiOperation({ summary: 'Get a complete history event detail' })
  @ApiParam({ name: 'event_id', description: 'history_events ID' })
  getEventDetail(
    @Param('event_id', ParseUUIDPipe) eventId: string,
  ): ReturnType<HistoryService['getEventDetail']> {
    return this.historyService.getEventDetail(eventId);
  }
}
