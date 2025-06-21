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
    ) { }

    @Process('create-bp')
    async handleCreateBP(job: Job<{ userId: string; cardName: string; phone: string }>) {
        const { userId, cardName, phone } = job.data;

        const cardCode = await this.sapService.checkOrCreateBusinessPartner({ cardName, phone });

        await this.knex('users')
            .where({ id: userId })
            .update({
                sap_card_code: cardCode,
                updated_at: new Date(),
            });
    }
}
