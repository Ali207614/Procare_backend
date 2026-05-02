import { Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderCommentType } from 'src/common/types/repair-order-comment.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { OnlinePbxRecordingService } from 'src/online-pbx/online-pbx-recording.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import {
  FindRepairOrderCommentsDto,
  RepairOrderCommentAudioFileDto,
  RepairOrderCommentItemDto,
  RepairOrderCommentsResponseDto,
} from '../dto/repair-order-comments.dto';

interface RepairOrderCommentRow {
  id: string;
  text: string;
  status: 'Open' | 'Deleted';
  comment_type: RepairOrderCommentType;
  history_change_id: string | null;
  created_at: string;
  updated_at: string;
  admin_id: string | null;
  admin_first_name: string | null;
  admin_last_name: string | null;
  admin_phone_number: string | null;
  status_id: string | null;
  status_name_uz: string | null;
  status_name_ru: string | null;
  status_name_en: string | null;
  status_can_user_view: boolean | null;
}

interface RepairOrderCommentAudioFileRow extends RepairOrderCommentAudioFileDto {
  updated_at?: string | Date | null;
  download_url_expires_at?: string | Date | null;
}

const ONLINE_PBX_SINGLE_RECORDING_INTERNAL_TTL_MS = 29 * 60 * 1000;
const COMMENT_TIME_ZONE = 'Asia/Tashkent';

@Injectable()
export class CommentReaderService {
  private readonly audioRefreshPromises = new Map<string, Promise<string | null>>();

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly onlinePbxRecordingService: OnlinePbxRecordingService,
  ) {}

  async findByRepairOrder(
    admin: AdminPayload,
    repairOrderId: string,
    query: FindRepairOrderCommentsDto,
  ): Promise<RepairOrderCommentsResponseDto> {
    const order = await this.knex('repair_orders')
      .select('branch_id', 'status_id')
      .where({ id: repairOrderId })
      .first<{ branch_id: string; status_id: string }>();

    if (!order) {
      throw new NotFoundException({ message: 'Order not found', location: 'repair_order_id' });
    }

    const permissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_view'],
      'repair_order_comments_view',
      permissions,
    );

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const types = this.normalizeTypes(query);
    const commentColumns = [
      'c.id',
      'c.text',
      'c.status',
      'c.comment_type',
      'c.history_change_id',
      'c.created_at',
      'c.updated_at',
      'a.id as admin_id',
      'a.first_name as admin_first_name',
      'a.last_name as admin_last_name',
      'a.phone_number as admin_phone_number',
      's.id as status_id',
      's.name_uz as status_name_uz',
      's.name_ru as status_name_ru',
      's.name_en as status_name_en',
      's.can_user_view as status_can_user_view',
    ];
    const audioFileColumns = [
      'id',
      'uuid',
      'direction',
      'event',
      'caller',
      'callee',
      'call_duration',
      'dialog_duration',
      'download_url',
      'download_url_expires_at',
      'created_at',
      'updated_at',
    ];

    const baseQuery = this.knex('repair_order_comments as c')
      .where('c.repair_order_id', repairOrderId)
      .where('c.status', 'Open')
      .modify((qb) => {
        if (types.length) {
          void qb.whereIn('c.comment_type', types);
        }
      });

    const rowsQuery = baseQuery
      .clone()
      .leftJoin('admins as a', 'a.id', 'c.created_by')
      .leftJoin('repair_order_statuses as s', 's.id', 'c.status_by')
      .select<CommentRowSelection[]>(commentColumns)
      .orderByRaw("CASE WHEN c.comment_type = 'manual' THEN 1 ELSE 2 END ASC")
      .orderBy('c.created_at', 'desc')
      .orderBy('c.id', 'desc')
      .offset(offset)
      .limit(limit);

    const countQuery = baseQuery.clone().count<{ total: string | number }[]>({ total: '*' });

    const audioFilesQuery = this.knex('phone_calls')
      .select<RepairOrderCommentAudioFileRow[]>(audioFileColumns)
      .where('repair_order_id', repairOrderId)
      .whereNotNull('download_url')
      .orderBy('created_at', 'desc');

    const [commentRows, countRows, cachedAudioFiles] = await Promise.all([
      rowsQuery,
      countQuery,
      audioFilesQuery,
    ]);
    const audioFiles = await this.refreshAudioDownloadUrls(cachedAudioFiles);

    return {
      comments: commentRows.map((row) => this.toCommentResponse(row)),
      total: Number(countRows[0]?.total ?? 0),
      limit,
      offset,
      timezone: COMMENT_TIME_ZONE,
      audio_files: audioFiles,
    };
  }

  private async refreshAudioDownloadUrls(
    audioFiles: RepairOrderCommentAudioFileRow[],
  ): Promise<RepairOrderCommentAudioFileDto[]> {
    return Promise.all(
      audioFiles.map(async (audioFile) => {
        const { updated_at, download_url_expires_at, ...responseAudioFile } = audioFile;
        if (
          this.isCachedDownloadUrlValid(
            responseAudioFile.download_url,
            download_url_expires_at,
            updated_at || responseAudioFile.created_at,
          )
        ) {
          return responseAudioFile;
        }

        const freshDownloadUrl = await this.getOrCreateRefreshPromise(
          responseAudioFile.id,
          responseAudioFile.uuid,
        );
        if (!freshDownloadUrl) {
          return responseAudioFile;
        }

        const now = new Date();
        await this.knex('phone_calls')
          .where({ id: responseAudioFile.id })
          .update({
            download_url: freshDownloadUrl,
            download_url_expires_at: this.buildDownloadUrlExpiresAt(now).toISOString(),
            updated_at: now.toISOString(),
          });

        return {
          ...responseAudioFile,
          download_url: freshDownloadUrl,
        };
      }),
    );
  }

  private getOrCreateRefreshPromise(phoneCallId: string, uuid: string): Promise<string | null> {
    const existingPromise = this.audioRefreshPromises.get(phoneCallId);
    if (existingPromise) return existingPromise;

    const refreshPromise = this.onlinePbxRecordingService
      .getFreshDownloadUrl(uuid)
      .finally(() => this.audioRefreshPromises.delete(phoneCallId));
    this.audioRefreshPromises.set(phoneCallId, refreshPromise);

    return refreshPromise;
  }

  private isCachedDownloadUrlValid(
    downloadUrl: string | null,
    expiresAt: string | Date | null | undefined,
    fallbackRefreshedAt: string | Date | null | undefined,
  ): boolean {
    if (!downloadUrl) return false;

    if (expiresAt) {
      const expiresAtTime = new Date(expiresAt).getTime();
      return Number.isFinite(expiresAtTime) && Date.now() < expiresAtTime;
    }

    if (!fallbackRefreshedAt) return false;

    const refreshedAtTime = new Date(fallbackRefreshedAt).getTime();
    if (!Number.isFinite(refreshedAtTime)) return false;

    return Date.now() - refreshedAtTime < ONLINE_PBX_SINGLE_RECORDING_INTERNAL_TTL_MS;
  }

  private buildDownloadUrlExpiresAt(refreshedAt: Date): Date {
    return new Date(refreshedAt.getTime() + ONLINE_PBX_SINGLE_RECORDING_INTERNAL_TTL_MS);
  }

  private normalizeTypes(query: FindRepairOrderCommentsDto): RepairOrderCommentType[] {
    const types = new Set<RepairOrderCommentType>();

    query.types?.forEach((type) => types.add(type));
    if (query.type) {
      types.add(query.type);
    }

    return [...types];
  }

  private toCommentResponse(row: RepairOrderCommentRow): RepairOrderCommentItemDto {
    const isManual = row.comment_type === 'manual';

    return {
      id: row.id,
      text: row.text,
      status: row.status,
      comment_type: row.comment_type,
      history_change_id: row.history_change_id,
      is_editable: isManual,
      is_deletable: isManual,
      created_by_admin: {
        id: row.admin_id,
        first_name: row.admin_first_name,
        last_name: row.admin_last_name,
        phone_number: row.admin_phone_number,
      },
      repair_order_status: {
        id: row.status_id,
        name_uz: row.status_name_uz,
        name_ru: row.status_name_ru,
        name_en: row.status_name_en,
        can_user_view: row.status_can_user_view,
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_at_local: this.formatLocalDateTime(row.created_at),
      updated_at_local: this.formatLocalDateTime(row.updated_at),
    };
  }

  private formatLocalDateTime(value: string): string {
    const date = new Date(value);
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: COMMENT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}:${lookup.second}`;
  }
}

type CommentRowSelection = RepairOrderCommentRow;
