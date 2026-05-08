import { Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { Offer } from '../common/types/offer.interface';
import { CreateOfferDto } from './dto/create-offer.dto';
import { FindAllOffersDto } from './dto/find-all-offers.dto';
import { PaginationResult } from '../common/utils/pagination.util';
import { PdfService } from 'src/pdf/pdf.service';
import { StorageService } from 'src/common/storage/storage.service';
import sanitizeHtml from 'sanitize-html';

const OFFER_PDF_PATH = 'offers/current.pdf';
const OFFER_PDF_URL_EXPIRY_SECONDS = 3600;

@Injectable()
export class OffersService {
  constructor(
    @InjectConnection() private readonly knex: Knex,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(dto: FindAllOffersDto): Promise<PaginationResult<Offer>> {
    const { limit = 10, offset = 0, status } = dto;

    const baseQuery = this.knex<Offer>('offers')
      .orderBy('is_active', 'desc')
      .orderBy('created_at', 'desc');

    if (status) {
      void baseQuery.where('status', status);
    }

    const [{ count }] = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ count: string | number }[]>('* as count');

    const rows = await baseQuery.limit(limit).offset(offset);

    return {
      total: Number(count),
      limit,
      offset,
      rows: rows as Offer[],
    };
  }

  async findOne(id: string): Promise<Offer> {
    const offer = await this.knex<Offer>('offers').where({ id }).first();
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }
    return offer;
  }

  async findActive(): Promise<Offer> {
    const offer = await this.knex<Offer>('offers')
      .where({ is_active: true, status: 'Open' })
      .orderBy('created_at', 'desc')
      .first();

    if (!offer) {
      throw new NotFoundException('No active offer found');
    }

    return offer;
  }

  async getPdfUrl(): Promise<{ url: string; expires_in: number }> {
    const activeOffer = await this.findActive();
    const files = await this.storageService.listFiles(OFFER_PDF_PATH);

    if (!files.includes(OFFER_PDF_PATH)) {
      await this.generateAndUploadOfferPdf(activeOffer.content_uz);
    }

    return {
      url: await this.storageService.generateUrl(OFFER_PDF_PATH, OFFER_PDF_URL_EXPIRY_SECONDS),
      expires_in: OFFER_PDF_URL_EXPIRY_SECONDS,
    };
  }

  async create(createOfferDto: CreateOfferDto): Promise<Offer> {
    const latestOffer = await this.knex<Offer>('offers').orderBy('created_at', 'desc').first();

    const nextVersion = latestOffer ? this.smartIncrement(latestOffer, createOfferDto) : 'v1.0.0';
    const pdfBuffer = await this.pdfService.generateOfferPdf(
      this.toOfferPdfHtml(createOfferDto.content_uz),
    );

    const newOffer = await this.knex.transaction(async (trx) => {
      // Mark all previous offers as inactive
      await trx('offers').update({ is_active: false });

      const [createdOffer]: Offer[] = await trx<Offer>('offers')
        .insert({
          ...createOfferDto,
          version: nextVersion,
          status: 'Open',
          is_active: true,
        })
        .returning('*');

      await this.storageService.upload(OFFER_PDF_PATH, pdfBuffer, {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-cache',
      });

      return createdOffer;
    });

    return newOffer;
  }

  async remove(id: string): Promise<void> {
    const offer = await this.findOne(id);
    await this.knex('offers')
      .where({ id: offer.id })
      .update({ status: 'Deleted', is_active: false });
  }

  private smartIncrement(oldOffer: Offer, newOffer: CreateOfferDto): string {
    const changePercentage = this.calculateChangePercentage(oldOffer, newOffer);

    const parts = oldOffer.version.replace('v', '').split('.');
    if (parts.length !== 3) return 'v1.0.0';

    let [major, minor, patch] = parts.map(Number);

    if (changePercentage > 70) {
      major++;
      minor = 0;
      patch = 0;
    } else if (changePercentage >= 20) {
      minor++;
      patch = 0;
    } else {
      patch++;
    }

    return `v${major}.${minor}.${patch}`;
  }

  private calculateChangePercentage(oldOffer: Offer, newOffer: CreateOfferDto): number {
    const oldVal = oldOffer.content_uz || '';
    const newVal = newOffer.content_uz || '';

    if (!oldVal && !newVal) return 0;

    const distance = this.levenshteinDistance(String(oldVal), String(newVal));
    const maxLen = Math.max(String(oldVal).length, String(newVal).length, 1);

    return (distance / maxLen) * 100;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const n = s1.length;
    const m = s2.length;

    if (n > m) return this.levenshteinDistance(s2, s1);

    let prevRow = new Int32Array(n + 1);
    let currRow = new Int32Array(n + 1);

    for (let i = 0; i <= n; i++) prevRow[i] = i;

    for (let i = 1; i <= m; i++) {
      currRow[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
        currRow[j] = Math.min(
          prevRow[j] + 1, // deletion
          currRow[j - 1] + 1, // insertion
          prevRow[j - 1] + cost, // substitution
        );
      }
      // Swap rows
      [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[n];
  }

  private async generateAndUploadOfferPdf(content: string): Promise<void> {
    const pdfBuffer = await this.pdfService.generateOfferPdf(this.toOfferPdfHtml(content));
    await this.storageService.upload(OFFER_PDF_PATH, pdfBuffer, {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'no-cache',
    });
  }

  private toOfferPdfHtml(content: string): string {
    const trimmed = content.trim();

    if (this.containsHtml(trimmed)) {
      return sanitizeHtml(trimmed, {
        allowedTags: [
          'p',
          'br',
          'strong',
          'b',
          'em',
          'i',
          'u',
          'ol',
          'ul',
          'li',
          'h1',
          'h2',
          'h3',
          'span',
        ],
        allowedAttributes: {},
      });
    }

    return this.plainTextToHtml(trimmed);
  }

  private containsHtml(value: string): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(value);
  }

  private plainTextToHtml(value: string): string {
    const blocks = value
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    return blocks
      .map((block) => {
        const lines = block
          .split(/\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line))) {
          return `<ul>${lines.map((line) => `<li>${this.escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
        }

        const escaped = this.escapeHtml(lines.join(' '));
        const numberedSection = escaped.match(/^(\d+\.\s*[^:]+:)(\s*.*)$/);

        if (numberedSection) {
          return `<p><strong>${numberedSection[1]}</strong>${numberedSection[2]}</p>`;
        }

        if (/^[^.!?]+:$/.test(escaped)) {
          return `<p><strong>${escaped}</strong></p>`;
        }

        return `<p>${escaped}</p>`;
      })
      .join('');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
