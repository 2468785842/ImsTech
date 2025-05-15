import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import 'source-map-support/register.js';

import chalk from 'chalk';
import { Page } from 'playwright-core';
import { format } from 'util';
import * as Activity from './activity.js';
import AIModel from './ai/AIModel.js';
import Config, { API_BASE_URL } from './config.js';
import * as Processor from './course/processor.js';
import * as Search from './course/search.js';
import { filterCookies, login, storeCookies } from './login.js';
import { input, waitForSPALoaded } from './utils.js';

async function init(page: Page) {
  // https://lms.ouchn.cn/user/index 返回会携带 WAF Cookie
  const cs = await page.evaluate(
    async () => await (window as any).cookieStore.getAll(),
  );

  // HWWAFSESID HWWAFSESTIME; 华为云 WAF 防护, 每次登陆都会更新
  // session; 会话Token
  await storeCookies(
    filterCookies(cs, ['session']).map((cookie) => ({
      ...cookie,
      domain: API_BASE_URL.substring('https://'.length),
    })),
  );

  //   await page.getByRole('link', { name: '我的课程' }).click();
  //   await waitForSPALoaded(page);

  const listItems = await Activity.getActivities();

  console.log('课程组数量: ', listItems.length);
  console.log(`0. 全部课程`);

  for (let i = 1; i <= listItems.length; i++) {
    console.log(`${i}. ${listItems[i - 1].title}`);
  }

  let num: number = -1;
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(0);
    }, 20000);
  });
  const userInputPromise = input(
    '选择一项课程完成(输入序号),20秒后自动选择`0`:',
  );
  console.log();
  num = Number(await Promise.race([userInputPromise, timeoutPromise]));
  if (isNaN(num)) {
    console.error('请输入数字');
    exit();
  }

  for (let item of num == 0 ? listItems : [listItems[num - 1]]) {
    console.log('-'.repeat(60));
    console.log(item.title, item.percent);

    // 考试需要特殊处理
    const courses = (await Search.getUncompletedCourses(page, item)).filter(
      (course) => course.progress != 'full' || course.type == 'exam',
    );

    for (const [i, course] of courses.entries()) {
      console.log(
        chalk.bgBlueBright(
          format(
            '%s %s %s %s : %d/%d',
            course.moduleName,
            course.syllabusName ?? '',
            course.activityName,
            course.progress,
            i + 1,
            courses.length,
          ),
        ),
      );

      const processor = Processor.getProcessor(course.type);
      if (!processor) {
        console.warn('不支持的课程类型:', Processor.getCourseType(course.type));
        continue;
      }

      if (processor.condition && !(await processor.condition(course))) {
        continue;
      }

      let tLoc = page.locator(`#${course.moduleId}`);
      if (course.syllabusId) {
        tLoc = tLoc.locator(`#${course.syllabusId}`);
      }

      const t = tLoc
        .locator(`#learning-activity-${course.activityId}`)
        .getByText(course.activityName, { exact: true });

      if ((await t.getAttribute('class'))!.lastIndexOf('locked') != -1) {
        console.log('课程锁定', '跳过');
        continue;
      }

      if (await t.locator('xpath=../*[contains(@class, "upcoming")]').count()) {
        console.log('课程未开始', '跳过');
        continue;
      }

      await t.click();

      await page.waitForURL(RegExp(`^${Config.urls.course()}.*`), {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      for (let count = 5; count > -1; count--) {
        await waitForSPALoaded(page);
        try {
          await processor?.exec(page);
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
        waitUntil: 'domcontentloaded',
      });
      await page.reload({
        timeout: 10000,
        waitUntil: 'domcontentloaded',
      });
      // console.debug("go back to course page");
    }
    await page.goBack({
      timeout: 0,
      waitUntil: 'domcontentloaded',
    });
  }
  console.log('program end...');
}

import { pathToFileURL } from 'url';
import { exit } from 'process';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    await AIModel.init(true);

    const { headless, slowMo } = Config.browser;

    const browser = await chromium.use(StealthPlugin()).launch({
      executablePath: process.env._CHROME_DEV!,
      headless,
      slowMo, // 搞太快会限制访问,
      timeout: 1000 * 60 * 2,
      ignoreDefaultArgs: headless ? ['--headless=old'] : [],
      args: headless ? ['--headless=new'] : [],
    });

    while (true) {
      try {
        const page = await login(browser);
        await init(page);
        // Teardown
        await browser.close();
        break;
      } catch (e) {
        console.warn('Error:', e);
        console.warn('retry');
      }
    }
  })();
}

export { init };

export * as Config from './config.js';
export * as Login from './login.js';
export * as Utils from './utils.js';
