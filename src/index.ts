import { chromium, Page } from 'playwright';
import 'source-map-support/register.js';

import 'dotenv/config';
import * as Activity from './Activity.js';
import * as Processor from './course/Processor.js';
import * as Search from './course/Search.js';
import { waitForSPALoaded } from './utils.js';

const loginUrl = `${process.env._LOGIN_URL!}/am/UI/Login`;

const userUrl = `${process.env._HOME_URL!}/user`;
const homeUrl = `${userUrl}/index#/`;

(async () => {
  // Setup
  const context = await chromium.launchPersistentContext(
    process.env._USER_DATA!,
    {
      // Fuck... because Chromuim not support h.264,so need replace for Chrome
      executablePath: process.env._CHROME_DEV!,
      headless: false,
      viewport: null,
      slowMo: 1000, // 搞太快会限制访问
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

    const courses = (await Search.getUncompletedCourses(page, item)).filter(
      (course) => course.progress != 'full'
    );

    for (const [i, course] of courses.entries()) {
      console.log(
        course.moduleName,
        course.syllabusName,
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

      let t = (await page
        .locator(`#${course.moduleId}`)
        .locator(`#${course.syllabusId}`)
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

      await page.waitForURL(RegExp(`^${Search.courseUrl}.*`), {
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
          await page.reload({ timeout: 3000 });
        }
      }

      // 回到课程选择页
      await page.goBack({
        timeout: 0,
        waitUntil: 'domcontentloaded'
      });
      await page.reload({ timeout: 10000, waitUntil: 'domcontentloaded' });
      // console.debug("go back to course page");
      console.log('-'.repeat(10));
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
  await page.getByPlaceholder('请输入登录名').fill(process.env._ACCOUNT!);
  await page.getByPlaceholder('请输入登录密码').fill(process.env._PASSWORD!);
  const agree = page.locator('#agreeCheckBox').first();
  if (!(await agree.isChecked())) {
    await agree.check();
  }
  await page.getByRole('button', { name: '登录' }).click();
  // 等待跳转, timeout 可能被父级 page option覆盖呢..., 在这里显式声明好了
  await page.waitForURL(homeUrl, { timeout: 30000 });
}
