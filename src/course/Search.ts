import { Locator, Page } from 'playwright';
import * as Activity from '../Activity.js';
import 'dotenv/config';
import { waitForSPALoaded } from '../utils.js';
import { CourseType, COURSE_TYPE } from './ExecStrategy.js';

type CourseProgress = 'full' | 'part' | 'none';

const courseUrl = `${process.env._HOME_URL!}/course`;

type CourseInfo = {
  id: string;
  type: CourseType;
  module: string;
  title: string;
  progress: CourseProgress;
};

async function getUncompletedCourses(
  page: Page,
  activityInfo: Activity.ActivityInfo
): Promise<CourseInfo[]> {
  console.log('正在获取未完成的课程...');

  let courseInfoList: CourseInfo[] = [];

  await page.getByText(activityInfo.title).click();
  await page.waitForURL(RegExp(`^${courseUrl}.*`));
  // await page.waitForTimeout(100);
  await page.locator('input[type="checkbox"]').setChecked(true);

  page
    .getByText('全部展开')
    .click({ timeout: 500 })
    .catch((_) => {
      console.warn('没有全部展开按钮,可能已经展开?');
    });

  // 也许有更高效的方法,逆向出加载函数然后监听?而不是等待2s
  // await page.waitForTimeout(2000);
  // await page.waitForLoadState('networkidle')
  await waitForSPALoaded(page);

  const modules = await page.locator('div.module').all();
  for (const module of modules) {
    const id = (await module.getAttribute('id'))!;
    const moduleName = await module.locator('span.module-name').textContent();
    //多个课程组
    const elements = await module
      .locator('div.learning-activities:not(.ng-hide)')
      .all();
    for (const element of elements) {
      // 课程
      const activities = await element
        .locator('div.learning-activity:not(.ng-hide)')
        .all();
      await Promise.all(
        activities.map(async (activity: Locator) => {
          // some stuff is finished, so is empty, we will skip
          try {
            if ('' == (await activity.innerHTML({ timeout: 1000 }))) return;
          } catch {
            return;
          }
          let courseInfo: CourseInfo = {
            id,
            type: await checkActivityType(activity),
            module: moduleName!,
            title: '',
            progress: 'none'
          };
          const complete = activity.locator(
            'activity-completeness-bar div.completeness'
          );

          // 需要注意的是, 页面元素有些是动态加载的, 这里必须等足够长时间...
          // 但是我们通过判断 ngProgress 宽度, 现在不需要了等待很长时间了
          // 最多等1s
          let progress = await complete
            .getAttribute('class', { timeout: 1000 })
            .catch(() => 'none');

          // check course progress
          for (let v of ['full', 'part', 'none'] as CourseProgress[]) {
            if (progress!.lastIndexOf(v) != -1) {
              courseInfo.progress = v;
              break;
            }
          }

          const titleElt = activity.locator('div.activity-title a.title');
          const title = await titleElt.textContent();
          if (!title) {
            console.log(activity);
            throw 'error: course title is undefined';
          }
          courseInfo.title = title;
          courseInfoList.push(courseInfo);
        })
      );
    }
  }
  return courseInfoList;
}

async function checkActivityType(activity: Locator): Promise<CourseType> {
  const icon = activity.locator('div.activity-icon>i.font');
  const cls = await icon.getAttribute('class');
  const prefix = 'font-syllabus-';
  if (cls) {
    const fStart = cls.indexOf(prefix);
    const front = cls.substring(fStart);
    const courseType = front.substring(prefix.length).replace('-', '_');
    return (courseType in COURSE_TYPE ? courseType : 'unknown') as CourseType;
  }
  return 'unknown';
}

export { getUncompletedCourses, courseUrl, CourseType, CourseProgress };
