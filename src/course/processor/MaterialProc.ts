import { Page } from 'playwright';

import { CourseType, Processor } from '../processor.js';

export default class Material implements Processor {
  name: CourseType = 'material';

  async exec(page: Page) {
    await page.waitForSelector('div.activity-material', { state: 'visible' });
    const pdfs = await page.locator('.activity-material a:text("查看")').all();
    for (const pdf of pdfs) {
      await pdf.click();
      await page.waitForLoadState();
      await page.locator('#file-previewer .header > a.close').click();
      //放置点击过快 延迟1.5秒
      new Promise(resolve => setTimeout(resolve,1500))
    }
  }
}
