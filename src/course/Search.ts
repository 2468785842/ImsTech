import { ElementHandle, Page } from "playwright";
import { expect } from "playwright/test";
import * as Activity from "../Activity.js";

type CourseProgress = "full" | "part" | "none";

const courseUrl = "https://lms.ouchn.cn/course/";

type CourseInfo = {
    id:string;
    module: string;
    title: string;
    progress: CourseProgress;
};

async function getUncompletedCourses(
    page: Page,
    activityInfo: Activity.ActivityInfo
): Promise<CourseInfo[]> {
    let courseInfos: CourseInfo[] = [];

    console.debug("获取未完成的活动: ", activityInfo.title);

    await page.getByText(activityInfo.title).click();
    await page.waitForURL(RegExp(`^${courseUrl}.*`));
    await page.waitForTimeout(100);
    await page.locator('input[type="checkbox"]').setChecked(true);
    try {
        const expand = page.getByText("全部展开");
        await expect(expand).toBeVisible({ timeout: 1000 });
        await expand.click();
    } catch {
        console.warn("没有??全部展开按钮,可能已经展开?");
    }

    // 也许有更高效的方法,逆向出加载函数然后监听?而不是等待3s
    await page.waitForTimeout(3000);
    const modules = await page.locator("div.module").all();
    for (const module of modules) {
        const id = (await module.getAttribute("id"))!!;
        const moduleName = await module
            .locator("span.module-name")
            .textContent();
        //多个课程组
        const elements = await module
            .locator("div.learning-activities:not(.ng-hide)")
            .elementHandles();
        for (const element of elements) {
            // 课程
            const activities = await element.$$(
                "div.learning-activity:not(.ng-hide)"
            );
            await Promise.all(
                activities.map(async (activity: ElementHandle) => {
                    let courseInfo: CourseInfo = {
                        id,
                        module: moduleName!!,
                        title: "",
                        progress: "none"
                    };
                    const complete = activity.$(
                        "activity-completeness-bar div.completeness"
                    );
                    const progress = await (
                        await complete
                    )?.getAttribute("class");
                    if (!progress) return;
                    // check course progress
                    for (let v of ["full", "part", "none"] as [
                        "full",
                        "part",
                        "none"
                    ]) {
                        if (progress!!.lastIndexOf(v) != -1) {
                            courseInfo.progress = v;
                            break;
                        }
                    }

                    const titleElt = await activity.$(
                        "div.activity-title a.title"
                    );
                    const title = await titleElt?.textContent();
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

export { getUncompletedCourses, courseUrl };
