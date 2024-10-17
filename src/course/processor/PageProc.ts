import { Page } from 'playwright';
import { CourseType, Processor, registerProcessor } from '../Processor.js';
import { waitForSPALoaded } from '../../utils.js';

export default class PageProc implements Processor {
  name: CourseType = 'page';

  async exec(page: Page) {
    await page.waitForTimeout(200);
    const rightScreen = page.locator('div.full-screen-mode-content');
    let scrollH = await rightScreen.evaluate((element) => {
      element.scrollTo({
        left: 0,
        top: element.scrollHeight,
        behavior: 'smooth'
      });
      return element.scrollHeight;
    });

    console.log(`scroll to ${scrollH}`);

    await waitForSPALoaded(page);
    await page.waitForLoadState('networkidle');

    const iframeHtml = page
      .frameLocator('#previewContentInIframe')
      .locator('html');
    try {
      await iframeHtml.waitFor({ state: 'visible', timeout: 7000 });
    } catch {
      // console.warn("not pdf or other? (can't find anything)");
      return;
    }

    scrollH = await iframeHtml.evaluate((element) => {
      element.scrollTo({
        left: 0,
        top: element.scrollHeight,
        behavior: 'smooth'
      });
      return element.scrollHeight;
    });

    console.log(`scroll to ${scrollH}`);
  }
}
