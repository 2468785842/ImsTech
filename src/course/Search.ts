import 'dotenv/config';
import { Locator, Page } from 'playwright';
import * as Activity from '../Activity.js';
import { waitForSPALoaded } from '../utils.js';
import { COURSE_TYPE, CourseType } from './processor.js';
import Config from '../config.js';

type CourseProgress = 'full' | 'part' | 'none';

type CourseInfo = {
  moduleId: string;
  moduleName: string;
  syllabusId: string | null;
  syllabusName: string | null;
  type: CourseType;
  activityId: number;
  activityName: string;
  progress: CourseProgress;
};

async function getModulesData(locs: Array<Locator>) {
  return await Promise.all(
    locs.map(async (module) => {
      const moduleId = (await module.getAttribute('id'))!;
      const moduleName = (await module
        .locator('span.module-name')
        .textContent())!.trim();

      const syllabusesLoc = await module.locator('div.course-syllabus').all();

      return { moduleId, moduleName, module, syllabusesLoc };
    })
  );
}

async function getSyllabusesData(moduleData: {
  moduleId: string;
  moduleName: string;
  module: Locator;
  syllabusesLoc: Locator[];
}) {
  const { moduleId, moduleName, module, syllabusesLoc } = moduleData;

  //多个课程组
  const getActivitiesList = (loc: Locator) =>
    loc.locator('div.learning-activities:not(.ng-hide)').all();

  if (syllabusesLoc.length != 0) {
    const syllabusesData = syllabusesLoc.map(async (syllabusLoc) => {
      const syllabusId = (await syllabusLoc.getAttribute('id'))!;
      const syllabusName = (await syllabusLoc
        .locator('div.syllabus-title')
        .textContent())!.trim();

      return {
        moduleId,
        moduleName,
        syllabusId,
        syllabusName,
        activitiesLocList: await getActivitiesList(syllabusLoc)
      };
    });

    return Promise.all(syllabusesData);
  }

  return [
    {
      moduleId,
      moduleName,
      syllabusId: null,
      syllabusName: null,
      activitiesLocList: await getActivitiesList(module)
    }
  ];
}

async function getUncompletedCourses(
  page: Page,
  activityInfo: Activity.ActivityInfo
): Promise<CourseInfo[]> {
  console.log('正在获取未完成的课程...');

  await page.getByText(activityInfo.title).click();
  await page.waitForURL(RegExp(`^${Config.urls.course()}.*`));
  await page.locator('input[type="checkbox"]').setChecked(true);

  await page
    .getByText('全部展开')
    .click({ timeout: 500 })
    .catch(() => {
      console.warn('没有全部展开按钮,可能已经展开?');
    });

  await waitForSPALoaded(page);
  const modules = await page.locator('div.module').all();
  const modulesData = await getModulesData(modules);

  const syllabusesData = (
    await Promise.all(modulesData.map(getSyllabusesData))
  ).flat();

  // some stuff is finished, so is empty, we will skip
  const hasContentActivity = async (activity: Locator) => {
    return (await activity.innerHTML({ timeout: 1000 }).catch(() => '')) != '';
  };

  // 过滤无内容和隐藏的活动 useableActivities
  const activitiesSync = syllabusesData.flatMap((syllabus) =>
    syllabus.activitiesLocList.map(async (activitiesLoc) => {
      const activityLocList = await activitiesLoc
        .locator('div.learning-activity:not(.ng-hide)')
        .all();

      const aLocList = activityLocList.filter(hasContentActivity);

      return aLocList.map(async (activityLoc) => ({
        moduleId: syllabus.moduleId,
        moduleName: syllabus.moduleName,
        syllabusId: syllabus.syllabusId,
        syllabusName: syllabus.moduleName,
        type: await getActivityType(activityLoc),
        activityId: await getActivityId(activityLoc),
        activityName: await getActivityName(activityLoc),
        activityLoc
      }));
    })
  );

  const activities = (await Promise.all(activitiesSync)).flat();

  // 最后填充进度和活动名
  const coursesData = activities.map(async (activity) => {
    const activ = await activity;
    const { activityLoc } = activ;

    const complete = activityLoc.locator(
      'activity-completeness-bar div.completeness'
    );

    // 需要注意的是, 页面元素有些是动态加载的, 这里必须等足够长时间...
    // 但是我们通过判断 ngProgress 宽度, 现在不需要了等待很长时间了
    // 最多等1s
    const progress = await complete
      .getAttribute('class', { timeout: 1000 })
      .catch(() => 'none');

    const getProgress = () =>
      (['full', 'part', 'none'].find((v) => progress?.includes(v)) ||
        'none') as CourseProgress;

    const courseData: typeof activ & {
      activityLoc: any;
    } & CourseInfo = {
      ...activ,
      progress: getProgress()
    };

    delete courseData.activityLoc;

    return courseData;
  });

  return Promise.all(coursesData);
}

async function getActivityName(activity: Locator) {
  const titleElt = activity.locator('div.activity-title a.title');
  const title = await titleElt.textContent();
  if (!title) {
    console.log(activity);
    throw 'error: course title is undefined';
  }
  return title;
}

async function getActivityType(activity: Locator): Promise<CourseType> {
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

async function getActivityId(activity: Locator): Promise<number> {
  const id = (await activity.getAttribute('id'))!;
  const prefix = 'learning-activity-';
  return Number(id.substring(id.indexOf(prefix) + 1));
}

export type { CourseProgress, CourseType, CourseInfo };
export { getUncompletedCourses };
