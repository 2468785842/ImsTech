import { Locator, Page } from "playwright";
import { expect } from "playwright/test";
import * as Activity from "../Activity.js";
import "dotenv/config";

type CourseProgress = "full" | "part" | "none";

const courseUrl = `${process.env._HOME_URL!!}/course`;

type CourseType =
    | "video"
    | "forum"
    | "page"
    | "liveStream"
    | "exam"
    | "material"
    | "unknown"; // TODO: 调查问卷, 线上连接

// 可以通过icon获取课程类型,而不是等到跳转课程页面获取, 加快速度
const COURSE_ICON: Record<string, CourseType> = {
    "font-syllabus-online-video": "video",
    "font-syllabus-forum": "forum",
    "font-syllabus-page": "page",
    "font-syllabus-tencent-meeting": "liveStream",
    "font-syllabus-exam": "exam",
    "font-syllabus-material": "material",
    unknown: "unknown"
};

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
    let courseInfos: CourseInfo[] = [];

    await page.getByText(activityInfo.title).click();
    await page.waitForURL(RegExp(`^${courseUrl}.*`));
    await page.waitForTimeout(100);
    await page.locator('input[type="checkbox"]').setChecked(true);
    try {
        const expand = page.getByText("全部展开");
        await expect(expand).toBeVisible({ timeout: 1000 });
        await expand.click();
    } catch {
        console.warn("没有全部展开按钮,可能已经展开?");
    }

    // 也许有更高效的方法,逆向出加载函数然后监听?而不是等待2s
    await page.waitForTimeout(2000);
    const modules = await page.locator("div.module").all();
    for (const module of modules) {
        const id = (await module.getAttribute("id"))!!;
        const moduleName = await module
            .locator("span.module-name")
            .textContent();
        //多个课程组
        const elements = await module
            .locator("div.learning-activities:not(.ng-hide)")
            .all();
        for (const element of elements) {
            // 课程
            const activities = await element
                .locator("div.learning-activity:not(.ng-hide)")
                .all();
            await Promise.all(
                activities.map(async (activity: Locator) => {
                    // something is finished, so is empty, we will skip
                    try {
                        if ("" == (await activity.innerHTML())) return;
                    } catch {
                        return;
                    }
                    let courseInfo: CourseInfo = {
                        id,
                        type: await checkActivityType(activity),
                        module: moduleName!!,
                        title: "",
                        progress: "none"
                    };
                    const complete = activity.locator(
                        "activity-completeness-bar div.completeness"
                    );
                    const progress = await complete.getAttribute("class", { timeout: 20000 }).catch(_ => null);
                    if (!progress) return;
                    // check course progress
                    for (let v of [
                        "full",
                        "part",
                        "none"
                    ] as CourseProgress[]) {
                        if (progress!!.lastIndexOf(v) != -1) {
                            courseInfo.progress = v;
                            break;
                        }
                    }

                    const titleElt = activity.locator(
                        "div.activity-title a.title"
                    );
                    const title = await titleElt.textContent();
                    if (!title) {
                        console.log(activity);
                        throw "unexception error: course title is undefined";
                    }
                    courseInfo.title = title;
                    courseInfos.push(courseInfo);
                })
            );
        }
    }
    return courseInfos;
}
async function checkActivityType(activity: Locator): Promise<CourseType> {
    const icon = activity.locator("div.activity-icon>i.font");
    for (const k in COURSE_ICON) {
        const cls = await icon.getAttribute("class");
        if (!cls) break;
        if (cls.lastIndexOf(k) != -1) {
            return COURSE_ICON[k];
        }
    }
    return "unknown";
}

export { getUncompletedCourses, courseUrl, CourseType, CourseProgress };
