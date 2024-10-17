import { Page } from 'playwright';

import { CourseType, Processor, registerProcessor } from '../Processor.js';

export default class Material implements Processor {
  name: CourseType = 'material';

  async exec(page: Page) {
    await page.waitForSelector('div.activity-material', { state: 'visible' });
    const pdfs = await page.locator('.activity-material a:text("查看")').all();
    for (const pdf of pdfs) {
      await pdf.click();
      await page.waitForLoadState();
      await page.locator('#file-previewer .header > a.close').click();
    }
  }
}

registerProcessor(new Material());
