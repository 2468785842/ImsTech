import 'dotenv/config';
import { Locator, Page } from 'playwright';
import * as Activity from '../Activity.js';
import { waitForSPALoaded } from '../utils.js';
import { COURSE_TYPE, CourseType } from './Processor.js';

type CourseProgress = 'full' | 'part' | 'none';

const courseUrl = `${process.env._HOME_URL!}/course`;

type CourseInfo = {
  moduleId: string;
  moduleName: string;
  syllabusId: string | null;
  syllabusName: string | null;
  type: CourseType;
  title: string;
  progress: CourseProgress;
};

async function getUncompletedCourses(
  page: Page,
  activityInfo: Activity.ActivityInfo
): Promise<CourseInfo[]> {
  console.log('正在获取未完成的课程...');

  await page.getByText(activityInfo.title).click();
  await page.waitForURL(RegExp(`^${courseUrl}.*`));
  // await page.waitForTimeout(100);
  await page.locator('input[type="checkbox"]').setChecked(true);

  page
    .getByText('全部展开')
    .click({ timeout: 500 })
    .catch(() => {
      console.warn('没有全部展开按钮,可能已经展开?');
    });

  // 也许有更高效的方法,逆向出加载函数然后监听?而不是等待2s
  // await page.waitForTimeout(2000);
  // await page.waitForLoadState('networkidle')
  await waitForSPALoaded(page);

  const modules = await page.locator('div.module').all();
  const modulesData = await Promise.all(
    modules.map(async (module) => {
      const moduleId = (await module.getAttribute('id'))!;
      const moduleName = (await module
        .locator('span.module-name')
        .textContent())!.trim();

      const syllabuses = await module.locator('div.course-syllabus').all();

      return {
        moduleId,
        moduleName,
        module,
        syllabuses
      };
    })
  );

  const syllabusesData = (
    await Promise.all(
      modulesData.map(async (moduleData) => {
        const { moduleId, moduleName, module, syllabuses } = moduleData;

        if (syllabuses.length != 0) {
          return await Promise.all(
            syllabuses.map(async (syllabus) => {
              const syllabusId = (await syllabus.getAttribute('id'))!;
              const syllabusName = (await syllabus
                .locator('div.syllabus-title')
                .textContent())!.trim();

              //多个课程组
              const activities = await syllabus
                .locator('div.learning-activities:not(.ng-hide)')
                .all();

              return {
                moduleId,
                moduleName,
                syllabusId,
                syllabusName,
                activities
              };
            })
          );
        }

        return {
          moduleId,
          moduleName,
          syllabusId: null,
          syllabusName: null,
          activities: await module
            .locator('div.learning-activities:not(.ng-hide)')
            .all()
        };
      })
    )
  ).flat();

  const coursesData = (
    await Promise.all(
      syllabusesData.map(async (syllabus) => {
        const { moduleId, moduleName, syllabusId, syllabusName, activities } =
          syllabus;
        // 课程
        return (
          await Promise.all(
            activities.map(async (activity) => {
              const useableActivities = await activity
                .locator('div.learning-activity:not(.ng-hide)')
                .all();
              return (
                await Promise.all(
                  useableActivities.map(async (useableActivity) => {
                    // some stuff is finished, so is empty, we will skip
                    if (
                      '' ==
                      (await useableActivity
                        .innerHTML({ timeout: 1000 })
                        .catch(() => ''))
                    )
                      return [];

                    let courseInfo: CourseInfo = {
                      moduleId,
                      moduleName,
                      syllabusId,
                      syllabusName,
                      type: await checkActivityType(useableActivity),
                      title: '',
                      progress: 'none'
                    };

                    const complete = useableActivity.locator(
                      'activity-completeness-bar div.completeness'
                    );

                    // 需要注意的是, 页面元素有些是动态加载的, 这里必须等足够长时间...
                    // 但是我们通过判断 ngProgress 宽度, 现在不需要了等待很长时间了
                    // 最多等1s
                    let progress = await complete
                      .getAttribute('class', { timeout: 1000 })
                      .catch(() => 'none');

                    // check course progress
                    courseInfo.progress = (['full', 'part', 'none'].find((v) =>
                      progress?.includes(v)
                    ) || 'none') as CourseProgress;

                    const titleElt = useableActivity.locator(
                      'div.activity-title a.title'
                    );
                    const title = await titleElt.textContent();
                    if (!title) {
                      console.log(useableActivity);
                      throw 'error: course title is undefined';
                    }
                    courseInfo.title = title;
                    return courseInfo;
                  })
                )
              ).flat();
            })
          )
        ).flat();
      })
    )
  ).flat();

  return coursesData;
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

export { CourseProgress, CourseType, courseUrl, getUncompletedCourses };
