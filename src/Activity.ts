import { ElementHandle, Page } from "playwright";

interface ActivityInfo {
    title: string;
    semester: string;
    code: string;
    startDate: string;
    percent: string;
}

async function getActivities(page: Page): Promise<ActivityInfo[]> {
    const olSelector = await page.waitForSelector("ol.courses");
    const liElements = await olSelector.$$("li");
    return await Promise.all(
        liElements.map(async (li: ElementHandle) => {
            // 标题
            const title = await (await li.$("div.course-title"))!!.innerText();
            // 学期
            const semester = await (await li.$(
                "div.course-academic-year-semester"
            ))!!.innerText();
            // 课程代码
            const code = await (await li.$(
                'span[tipsy="course.course_code"]'
            ))!!.innerText();
            // 课程开始时间
            const startDate = await (await li.$(
                'span[ng-bind="course.start_date"]'
            ))!!.innerText();
            // 学习进度
            const percent = await (await li.$(
                "section.percent span[ng-bind=\"course.completeness + '%'\"]"
            ))!!.innerText();

            return { title, semester, code, startDate, percent };
        })
    );
}

export { getActivities, ActivityInfo };
