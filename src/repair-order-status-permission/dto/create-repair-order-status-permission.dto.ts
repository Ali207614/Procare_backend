import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';

export class AssignRepairOrderStatusPermissionsDto {
  @ApiProperty()
  @IsUUID('all', { context: { location: 'branch_id' } })
  branch_id!: string;

  @ApiProperty({ type: [String] })
  @IsArray({ context: { location: 'status_ids' } })
  @ArrayNotEmpty({ context: { location: 'status_ids' } })
  @ArrayUnique({ context: { location: 'status_ids' } })
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    each: true,
    message: 'Each value in status_ids must be a UUID or custom status ID',
    context: { location: 'status_ids' },
  })
  status_ids!: string[];

  @ApiProperty()
  @IsUUID('all', { context: { location: 'role_id' } })
  role_id!: string;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_add?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_view?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_update?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_delete?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_payment_add?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_payment_cancel?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_assign_admin?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_notification?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_notification_bot?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_change_active?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_change_status?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_view_initial_problems?: boolean;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  can_change_initial_problems?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_view_final_problems?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_change_final_problems?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_comment?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_pickup_manage?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_delivery_manage?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_view_payments?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_view_history?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_manage_rental_phone?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() can_user_manage?: boolean;

  @ApiProperty({
    required: false,
    description:
      'If enabled, moving a repair order to this status will automatically create a user in the database if one does not exist with the provided phone number.',
  })
  @IsOptional()
  @IsBoolean()
  can_create_user?: boolean;
}
