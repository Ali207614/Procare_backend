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
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Recommended for Docker/Linux environments
    });

    try {
      const mergedPdf = await PDFDocument.create();
      const pagesToRender = [
        'page_1.html',
        'page_2.html',
        'page_3.html',
        'page_4.html',
        'page_5.html',
      ];

      for (const fileName of pagesToRender) {
        this.logger.debug(`Rendering ${fileName}...`);
        const page = await browser.newPage();

        // Resolve path to the copied templates in the dist/ directory
        const filePath = path.join(__dirname, '..', 'pdf-templates', fileName);
        await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

        await page.setViewport({
          width: 1122,
          height: 794,
          deviceScaleFactor: 2,
        });

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

        // Generate PDF buffer for this page
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        // Merge this page into the final PDF
        const currentPdf = await PDFDocument.load(pdfBuffer);
        const copiedPages = await mergedPdf.copyPages(currentPdf, currentPdf.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));

        await page.close();
      }

      const finalPdfBytes = await mergedPdf.save();
      return Buffer.from(finalPdfBytes);
    } catch (error) {
      this.logger.error('Failed to generate PDF', error);
      throw new InternalServerErrorException('Failed to generate service form document');
    } finally {
      await browser.close();
    }
  }
}
