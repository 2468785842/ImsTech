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
async function withRandomDelay<T>(
  page: Page,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const delay = Config.browser.slowMo();
    await page.waitForTimeout(delay);
    return await operation();
  } catch (error: any) {
    if (
      error.message.includes('Target page, context or browser has been closed')
    ) {
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
        console.log();
      }, 20000);
    });
    const userInputPromise = input(
      '选择一项课程完成(输入序号),20秒后自动选择`0`:',
    );
    num = Number(await Promise.race([userInputPromise, timeoutPromise]));
    if (isNaN(num)) {
      console.error('请输入数字');
      exit();
    }

    for (let item of num == 0 ? listItems : [listItems[num - 1]]) {
      console.log('-'.repeat(60));
      console.log(item.title, item.percent);

      let courses: Search.CourseInfo[] = [];
      // 考试需要特殊处理
      try {
        courses = (await Search.getUncompletedCourses(page, item)).filter(
          (course) => course.progress != 'full' || course.type == 'exam',
        );
        // 使“未完成”取消勾选，防止已完成测试阻塞执行
        await page.locator('input[type="checkbox"]').setChecked(false);
      } catch (e) {
        console.log(`[${item.title}]课程异常，跳过`);
        if (num == 0) {
          continue;
        }
        //非全部课程停止执行并重新发送课程菜单
        await page.goBack({
          timeout: 0,
          waitUntil: 'domcontentloaded',
        });
        return init(page);
      }

      console.log('courses', courses);
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
          console.warn(
            '不支持的课程类型:',
            Processor.getCourseType(course.type),
          );
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

        if (
          await t.locator('xpath=../*[contains(@class, "upcoming")]').count()
        ) {
          console.log('课程未开始', '跳过');
          continue;
        }

        // 从这里开始添加随机延迟
        try {
          await withRandomDelay(page, () => t.click());
        } catch (e) {
          /**
           * 这里必须跳过
           * 因为第二次打开脚本后
           * 学习网会默认勾选只显示未学内容
           * 但已经完成的自测考试依然会来到这里执行点击操作
           * 此时网页内自测考试已经被隐藏，导致寻找不到元素后整个脚本崩溃
           */
          //console.log("无法进入该课程，该课程可能已经完成学习。跳过");
          continue;
        }
        await withRandomDelay(page, () =>
          page.waitForURL(RegExp(`^${Config.urls.course()}.*`), {
            timeout: 30000,
            waitUntil: 'domcontentloaded',
          }),
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
              page.reload({ timeout: 1000 * 60 }),
            );
          }
        }

        // 回到课程选择页
        await withRandomDelay(page, () =>
          page.goBack({
            timeout: 0,
            waitUntil: 'domcontentloaded',
          }),
        );
        await withRandomDelay(page, () =>
          page.reload({
            timeout: 10000,
            waitUntil: 'domcontentloaded',
          }),
        );
      }
      await withRandomDelay(page, () =>
        page.goBack({
          timeout: 0,
          waitUntil: 'domcontentloaded',
        }),
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

const arg = process.argv[1];

if (arg && import.meta.url === pathToFileURL(arg).href) {
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
          await new Promise((resolve) => setTimeout(resolve, 5000));
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

export { init, Config, login };
