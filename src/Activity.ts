import { Locator, Page } from "playwright";

interface ActivityInfo {
    title: string;
    semester: string;
    code: string;
    startDate: string;
    percent: string;
}

async function getActivities(page: Page): Promise<ActivityInfo[]> {
    const liElements = await page.locator("ol.courses li").all();
    return await Promise.all(
        liElements.map(async (li: Locator) => {
            // 标题
            const title = await li
                .locator("div.course-title")
                .innerText();

            // 学期
            const semester = await li
                .locator("div.course-academic-year-semester")
                .innerText();

            // 课程代码
            const code = await li
                .locator('span[tipsy="course.course_code"]')
                .innerText();

            // 课程开始时间
            const startDate = await li
                .locator('span[ng-bind="course.start_date"]')
                .innerText();

            // 学习进度
            const percent = await li
                .locator("section.percent span[ng-bind=\"course.completeness + '%'\"]")
                .innerText();

            return { title, semester, code, startDate, percent };
        })
    );
}

export { getActivities, ActivityInfo };
