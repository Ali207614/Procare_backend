import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import * as path from 'path';
import { PdfPayload } from './interfaces/pdf-payload.interface';

interface PuppeteerWindow extends Window {
  renderApp?: (data: PdfPayload) => void;
  isRendered?: boolean;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateProcareServiceForm(payload: PdfPayload): Promise<Buffer> {
    return this.generatePdfFromTemplates(payload, ['page_1.html', 'page_2.html']);
  }

  async generateWarrantyAgreement(payload: PdfPayload): Promise<Buffer> {
    return this.generatePdfFromTemplates(payload, ['page_4.html', 'page_5.html']);
  }

  private async generatePdfFromTemplates(
    payload: PdfPayload,
    pagesToRender: string[],
  ): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'], // Recommended for Docker/Linux environments
    });

    try {
      const mergedPdf = await PDFDocument.create();

      // ⚡ Bolt: Process pages in parallel
      // Performance Impact: Renders all selected templates concurrently,
      // reducing total Puppeteer rendering time by up to ~50%.
      const pdfBuffers = await Promise.all(
        pagesToRender.map(async (fileName) => {
          this.logger.debug(`Rendering ${fileName}...`);
          const page = await browser.newPage();
          const isPortraitTemplate = fileName === 'page_5.html';

          try {
            await page.setViewport({
              width: isPortraitTemplate ? 794 : 1122,
              height: isPortraitTemplate ? 1122 : 794,
              deviceScaleFactor: 2,
            });

            // Resolve path to the copied templates in the dist/ directory
            const filePath = path.join(__dirname, '..', 'pdf-templates', fileName);
            await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

            // Inject payload and render
            await page.evaluate((data: PdfPayload) => {
              const win = window as unknown as PuppeteerWindow;
              if (win.renderApp) {
                win.renderApp(data);
              }
            }, payload);

            // Wait for rendering to complete
            await page.waitForFunction(
              () => (window as unknown as PuppeteerWindow).isRendered === true,
            );

            return await page.pdf({
              format: 'A4',
              landscape: !isPortraitTemplate,
              printBackground: true,
              margin: { top: '0', right: '0', bottom: '0', left: '0' },
            });
          } finally {
            await page.close();
          }
        }),
      );

      // Merge PDFs sequentially to preserve order
      for (const pdfBuffer of pdfBuffers) {
        const currentPdf = await PDFDocument.load(pdfBuffer);
        const copiedPages = await mergedPdf.copyPages(currentPdf, currentPdf.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));
      }

      const finalPdfBytes = await mergedPdf.save();
      return Buffer.from(finalPdfBytes);
    } catch (error) {
      this.logger.error('Failed to generate PDF', error);
      throw new InternalServerErrorException(
        `Failed to generate PDF document: ${(error as Error)?.message || 'Unknown Context'}`,
      );
    } finally {
      await browser.close();
    }
  }

  async generateOfferPdf(offerContent: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();

      try {
        await page.setViewport({
          width: 794,
          height: 1123,
          deviceScaleFactor: 2,
        });

        const filePath = path.join(__dirname, '..', 'pdf-templates', 'offer.html');
        await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

        await page.evaluate((content: string) => {
          const win = window as unknown as PuppeteerWindow;
          if (win.renderApp) {
            win.renderApp({ offer_content: content } as PdfPayload);
          }
        }, offerContent);

        await page.waitForFunction(
          () => (window as unknown as PuppeteerWindow).isRendered === true,
        );

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        return Buffer.from(pdfBuffer);
      } finally {
        await page.close();
      }
    } catch (error) {
      this.logger.error('Failed to generate offer PDF', error);
      throw new InternalServerErrorException(
        `Failed to generate offer document: ${(error as Error)?.message || 'Unknown Context'}`,
      );
    } finally {
      await browser.close();
    }
  }
}
