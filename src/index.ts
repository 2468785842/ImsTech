import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import 'source-map-support/register.js';

import * as Activity from './Activity.js';
import * as Processor from './course/Processor.js';
import * as Search from './course/Search.js';
import { waitForSPALoaded } from './utils.js';
import Config from './config.js';
import { login } from './Login.js';

(async () => {
  const browser = await chromium.use(StealthPlugin()).launch({
    executablePath: process.env._CHROME_DEV!,
    headless: false,
    slowMo: 1000 // 搞太快会限制访问
  });
  const page = await login(browser);

  await page.getByRole('link', { name: '我的课程' }).click();
  await waitForSPALoaded(page);
  await page.waitForLoadState('networkidle');

  const listItems = await Activity.getActivities(page);

  console.log('课程组数量: ', listItems.length);

  for (let item of listItems) {
    console.log('-'.repeat(60));
    console.log(item.title, item.percent);

    const courses = (await Search.getUncompletedCourses(page, item)).filter(
      (course) => course.progress != 'full'
    );

    for (const [i, course] of courses.entries()) {
      console.log(
        course.moduleName,
        course.syllabusName ?? '',
        course.title,
        course.progress,
        `: ${i}/${courses.length}`
      );

      const processor = Processor.getProcessor(course.type);
      if (!processor) {
        console.warn(
          '不支持的课程类型:',
          Processor.COURSE_TYPE[course.type],
          '\n'
        );
        continue;
      }

      if (processor.condition && !processor.condition(course.progress)) {
        continue;
      }

      let tLoc = page.locator(`#${course.moduleId}`);
      if (course.syllabusId) {
        tLoc = tLoc.locator(`#${course.syllabusId}`);
      }
      const t = (await tLoc
        .getByText(course.title, { exact: true })
        .elementHandle())!;

      if ((await t.getAttribute('class'))!.lastIndexOf('locked') != -1) {
        console.log('课程锁定', '跳过');
        continue;
      }

      if (await t.$('xpath=../*[contains(@class, "upcoming")]')) {
        console.log('课程未开始', '跳过');
        continue;
      }

      await t.click({ timeout: 5000 });

      await page.waitForURL(RegExp(`^${Config.urls.course()}.*`), {
        timeout: 3000,
        waitUntil: 'domcontentloaded'
      });

      for (let count = 5; count > -1; count--) {
        await waitForSPALoaded(page);
        try {
          await processor.exec(page);
          break;
        } catch (e) {
          console.error(e);
          console.log('process course failed: retry', count);
          await page.reload({ timeout: 1000 * 60 });
        }
      }

      // 回到课程选择页
      await page.goBack({
        timeout: 0,
        waitUntil: 'domcontentloaded'
      });
      await page.reload({
        timeout: 10000,
        waitUntil: 'domcontentloaded'
      });
      // console.debug("go back to course page");
    }
    await page.goBack({
      timeout: 0,
      waitUntil: 'domcontentloaded'
    });
  }
  console.log('program end...');
  // Teardown
  await browser.close();
})();
