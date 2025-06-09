import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class FeatureService {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
    ) { }

    private readonly table = 'app_features';
    private readonly cacheKey = 'app:features';
    private readonly cacheTtl = 300; // 5 minut

    async getAllFeatures(): Promise<Record<string, boolean>> {
        const cached = await this.redisService.get(this.cacheKey);
        if (cached) return cached;

        const features = await this.knex(this.table).select('feature_key', 'is_active');
        const result = {};
        for (const f of features) {
            result[f.feature_key] = f.is_active;
        }

        await this.redisService.set(this.cacheKey, result, this.cacheTtl);
        return result;
    }

    async isFeatureActive(key: string): Promise<boolean> {
        const features = await this.getAllFeatures();
        if (!(key in features)) {
            throw new NotFoundException({
                message: `❌ Feature not found.`,
                location: 'feature_missing',
            });
        }

        return features[key];
    }

    async updateFeature(key: string, is_active: boolean) {
        const affected = await this.knex(this.table)
            .update({ is_active, updated_at: this.knex.fn.now() })
            .where({ feature_key: key });

        if (!affected) {
            throw new NotFoundException({
                message: '❌ Feature not found.',
                location: 'feature_missing',
            });
        }

        await this.redisService.del(this.cacheKey); // Cache invalidation

        return { message: '✅ Feature updated successfully.' };
    }
}
