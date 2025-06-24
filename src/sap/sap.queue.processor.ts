import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull'; // faqat shu kerak
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { SapService } from './sap.service';

@Processor('sap')
export class SapQueueProcessor {
  constructor(
    private readonly sapService: SapService,
    @InjectKnex() private readonly knex: Knex,
  ) {}

  @Process('create-bp')
  async handleCreateBP(job: Job<{ userId: string; cardName: string; phone: string }>) {
    const { userId, cardName, phone } = job.data;

    const cardCode = await this.sapService.checkOrCreateBusinessPartner({ cardName, phone });

    await this.knex('users').where({ id: userId }).update({
      sap_card_code: cardCode,
      updated_at: new Date(),
    });
  }

  @Process('create-rental-order')
  async handleCreateRentalOrder(
    job: Job<{
      repair_order_rental_phone_id: string;
      cardCode: string;
      itemCode: string;
      startDate: string;
    }>,
  ) {
    const { repair_order_rental_phone_id, cardCode, itemCode, startDate } = job.data;

    const sapOrderId = await this.sapService.createRentalOrder(cardCode, itemCode, startDate);

    await this.knex('repair_order_rental_phones')
      .where({ id: repair_order_rental_phone_id })
      .update({
        sap_order_id: sapOrderId,
        updated_at: new Date(),
      });
  }

  @Process('cancel-rental-order')
  async handleCancelRentalOrder(job: Job<{ sap_order_id: string }>) {
    const { sap_order_id } = job.data;

    await this.sapService.cancelRentalOrder(sap_order_id);
  }
}
