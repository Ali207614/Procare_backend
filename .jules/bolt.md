## 2023-10-25 - Parallelizing PDF page generation
**Learning:** Found sequential page rendering using Puppeteer within `src/pdf/pdf.service.ts` using `for...of` loops and `await`. Puppeteer tabs (pages) can be generated in parallel within the same browser instance, yielding massive speed improvements, especially when multiple heavy pages are rendered.
**Action:** Used `Promise.all` alongside `.map()` to render tabs in parallel, storing output buffers in arrays to maintain correct page order for merging into the final document.
