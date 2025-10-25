import 'source-map-support/register.js';

import chalk from 'chalk';
import { Page } from 'playwright-core';
import { format } from 'util';
import * as Activity from './activity.js';
import Config, { API_BASE_URL, printConfigStatus } from './config.js';
import * as Processor from './course/processor.js';
import * as Search from './course/search.js';
import { filterCookies, login, storeCookies } from './login.js';
import { errorWithRetry, input, waitForSPALoaded } from './utils.js';

import { exit } from 'process';

async function init(page: Page) {
  if (
    (await page
      .getByText(
        '您好，您的账号被检测到异常访问行为，您的账号将被禁止访问教学平台，时限1小时。',
      )
      .count()) != 0
  ) {
    console.error(
      chalk.bgRed('抱歉，程序触发了网站的风控系统,目前你已经被禁止访问'),
    );
    exit(1);
  }

  printConfigStatus();
  // https://lms.ouchn.cn/user/index 返回会携带 WAF Cookie
  const cs = await page.evaluate(
    async () => await (window as any).cookieStore.getAll(),
  );

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
    if (!item.percent) continue;

    let courses: Search.CourseInfo[] = [];
    // 考试需要特殊处理
    try {
      courses = (await Search.getUncompletedCourses(page, item)).filter(
        (course) => course.progress != 'full' || course.type == 'exam',
      );
      // 使“未完成”取消勾选，防止已完成测试阻塞执行
      await page.locator('input[type="checkbox"]').setChecked(false);
    } catch (e: any) {
      console.log(`[${item.title}]课程异常，跳过: ${e.message ?? e}`);
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

      /**
       * 第二次打开脚本后, 默认勾选只显示未学内容
       * 但已经完成的自测考试依然会来到这里执行点击操作
       * 此时网页内自测考试已经被隐藏，导致寻找不到元素后整个脚本崩溃
       * ignore error for catch()
       */
      try {
        await t.click();
      } catch {
        continue;
      }
      await page.waitForURL(RegExp(`^${Config.urls.course()}.*`), {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      await errorWithRetry(
        `处理=>${Processor.getCourseType(processor.name)}<=课程`,
        5,
      )
        .retry(async () => {
          await page.reload({ timeout: 1000 * 60 });
        })
        .failed((e) => {
          throw `程序执行出错: ${e}`;
        })
        .run(async () => {
          await waitForSPALoaded(page);
          await processor.exec(page);
        });

      // 回到课程选择页
      await page.goBack({
        timeout: 0,
        waitUntil: 'domcontentloaded',
      });

      await page.reload({
        timeout: 10000,
        waitUntil: 'domcontentloaded',
      });
    }

    await page.goBack({
      timeout: 0,
      waitUntil: 'domcontentloaded',
    });
  }
  console.log('执行完毕!!');
}

export { init, Config, login };
