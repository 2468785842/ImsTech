import { chromium, Page } from 'playwright';
import 'source-map-support/register.js';

import * as Activity from './Activity.js';
import * as ExecStrategy from './course/ExecStrategy.js';
import * as Search from './course/Search.js';
import 'dotenv/config';
import { waitForSPALoaded } from './utils.js';

const loginUrl = `${process.env._LOGIN_URL!!}/am/UI/Login`;

const userUrl = `${process.env._HOME_URL!!}/user`;
const homeUrl = `${userUrl}/index#/`;

// import AIModel from './ai/AIModel.js';

// (async () => {
//   await (await AIModel.create())?.getResponse('你是谁');
//   await (await AIModel.create())?.getResponse('哈喽!');
// })();

(async () => {
  // Setup
  const context = await chromium.launchPersistentContext(
    process.env._USER_DATA!!,
    {
      // Fuck... because Chromuim not support h.264,so need replace for Chrome
      executablePath: process.env._CHROME_DEV!!,
      headless: false,
      viewport: null,
      slowMo: 3000, // 搞太快会限制访问
      bypassCSP: true,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled'
      ] //关闭自动控制特征
    }
  );
  let page = context.pages()[0];
  await page.goto(homeUrl);
  // 判断是否登录
  await page
    .waitForURL(RegExp(`^${loginUrl}.*`), { timeout: 3000 })
    .then(async () => {
      console.log('to login');
      await login(page);
    })
    .catch(() => {
      console.log('is logined');
    });

  await page.getByRole('link', { name: '我的课程' }).click();
  await waitForSPALoaded(page);
  await page.waitForLoadState('networkidle');

  const listItems = await Activity.getActivities(page);

  console.log('课程组数量: ', listItems.length);

  for (let item of listItems) {
    console.log(item.title, item.percent);

    let courses = await Search.getUncompletedCourses(page, item);
    courses = courses.filter((course) => course.progress != 'full');
    let i = 0;

    for (let course of courses) {
      console.log(
        course.module,
        course.title,
        course.progress,
        `: ${++i}/${courses.length}`
      );

      const strategy = ExecStrategy.strategyTable[course.type];
      if (!strategy) {
        console.warn(
          '不支持的课程类型:',
          ExecStrategy.COURSE_TYPE[course.type],
          '\n'
        );
        continue;
      }

      let t = page
        .locator(`#${course.id}`)
        .getByText(course.title, { exact: true })
        .first();

      try {
        if (
          (await t.getAttribute('class', { timeout: 100 }))!!.lastIndexOf(
            '.locked'
          ) != -1
        ) {
          console.log('课程锁定', '跳过');
          continue;
        }

        if (
          await t
            .locator('xpath=../*[contains(@class, "upcoming")]')
            .isVisible()
        ) {
          console.log('课程未开始', '跳过');
          continue;
        }
      } catch {}

      await t.click({ timeout: 0 });

      await page.waitForURL(RegExp(`^${Search.courseUrl}.*`), {
        timeout: 3000,
        waitUntil: 'domcontentloaded'
      });

      for (let count = 5; count > -1; count--) {
        await waitForSPALoaded(page);
        try {
          await strategy(page, course.progress);
          break;
        } catch (e) {
          console.error(e);
          console.log('exec strategy failed: retry', count);
          await page.reload({ timeout: 3000 });
        }
      }

      // 回到课程选择页
      await page.goBack({
        timeout: 0,
        waitUntil: 'domcontentloaded'
      });
      await page.reload({ timeout: 0, waitUntil: 'domcontentloaded' });
      // console.debug("go back to course page");
    }
    await page.goBack({
      timeout: 0,
      waitUntil: 'domcontentloaded'
    });
  }
  console.log('program end...');
  // Teardown
  await context.close();
})();

async function login(page: Page) {
  await page.getByPlaceholder('请输入登录名').fill(process.env._ACCOUNT!!);
  await page.getByPlaceholder('请输入登录密码').fill(process.env._PASSWORD!!);
  const agree = page.locator('#agreeCheckBox').first();
  if (!(await agree.isChecked())) {
    await agree.check();
  }
  await page.getByRole('button', { name: '登录' }).click();
  // 等待跳转, timeout 可能被父级 page option覆盖呢..., 在这里显式声明好了
  await page.waitForURL(homeUrl, { timeout: 0 });
}
