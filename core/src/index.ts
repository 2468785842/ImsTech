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

// 创建一个包装函数，在每次操作前添加随机延迟
async function withRandomDelay<T>(page: Page, operation: () => Promise<T>): Promise<T> {
  try {
    const delay = Config.browser.slowMo();
    await page.waitForTimeout(delay);
    return await operation();
  } catch (error: any) {
    if (error.message.includes('Target page, context or browser has been closed')) {
      console.log('页面已关闭，跳过延迟操作');
      return operation();
    }
    throw error;
  }
}

async function init(page: Page) {
  try {
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

        // 从这里开始添加随机延迟
        await withRandomDelay(page, () => t.click());

        await withRandomDelay(page, () => 
          page.waitForURL(RegExp(`^${Config.urls.course()}.*`), {
            timeout: 30000,
            waitUntil: 'domcontentloaded',
          })
        );

        for (let count = 5; count > -1; count--) {
          await withRandomDelay(page, () => waitForSPALoaded(page));
          try {
            await withRandomDelay(page, () => processor?.exec(page));
            break;
          } catch (e) {
            console.error(e);
            console.log('process course failed: retry', count);
            await withRandomDelay(page, () => 
              page.reload({ timeout: 1000 * 60 })
            );
          }
        }

        // 回到课程选择页
        await withRandomDelay(page, () => 
          page.goBack({
            timeout: 0,
            waitUntil: 'domcontentloaded',
          })
        );
        await withRandomDelay(page, () => 
          page.reload({
            timeout: 10000,
            waitUntil: 'domcontentloaded',
          })
        );
      }
      await withRandomDelay(page, () => 
        page.goBack({
          timeout: 0,
          waitUntil: 'domcontentloaded',
        })
      );
    }
    console.log('program end...');
  } catch (error) {
    console.error('程序执行出错:', error);
    throw error;
  }
}

import { pathToFileURL } from 'url';
import { exit } from 'process';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    let browser;
    try {
      await AIModel.init(true);

      const { headless } = Config.browser;

      browser = await chromium.use(StealthPlugin()).launch({
        executablePath: process.env._CHROME_DEV!,
        headless,
        slowMo: 0, // 不使用 Playwright 的 slowMo，我们使用自己的延迟机制
        timeout: 1000 * 60 * 2,
        ignoreDefaultArgs: headless ? ['--headless=old'] : [],
        args: headless ? ['--headless=new'] : [],
      });

      let retryCount = 0;
      const maxRetries = 5;

      while (retryCount < maxRetries) {
        try {
          const page = await login(browser);
          await init(page);
          break;
        } catch (e) {
          console.warn('Error:', e);
          console.warn(`retry ${retryCount + 1}/${maxRetries}`);
          retryCount++;
          
          if (retryCount >= maxRetries) {
            console.error('达到最大重试次数，程序退出');
            break;
          }
          
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error('程序启动失败:', error);
    } finally {
      if (browser) {
        await browser.close();
      }
      exit(1);
    }
  })();
}

export { init };