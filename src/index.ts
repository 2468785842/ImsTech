import { chromium, Page } from "playwright";
import * as Activity from "./Activity.js";
import * as ExecStrategy from "./course/ExecStrategy.js";
import * as Search from "./course/Search.js";
import "dotenv/config";

const coursesUrl = "https://lms.ouchn.cn/user/courses#/";
const homeUrl = "https://lms.ouchn.cn/user/index#/";
const loginUrl = `https://iam.pt.ouchn.cn/am/UI/Login`;

(async () => {
    // Setup
    const context = await chromium.launchPersistentContext(
        process.env._USER_DATA!!,
        {
            //fuck... because chromuim not support h.264,so need replace,
            executablePath: process.env._CHROME_DEV!!,
            headless: false,
            viewport: null,
            slowMo: 50,
            bypassCSP: true,
            args: [
                "--start-maximized",
                "--disable-blink-features=AutomationControlled"
            ] //关闭自动控制特征
        }
    );
    let page = context.pages()[0];
    await page.goto(homeUrl);
    // 判断是否登录
    await page
        .waitForURL(RegExp(`^${loginUrl}.*`), { timeout: 2000 })
        .then(async () => {
            console.log("to login");
            await login(page);
        })
        .catch(() => {
            console.log("is logined");
        });

    await page.getByRole("link", { name: "我的课程" }).click();
    await page.waitForURL(coursesUrl, { timeout: 0, waitUntil: "load" });

    const listItems = await Activity.getActivities(page);
    for (let item of listItems) {
        console.log(item.title, item.percent);

        let courses = await Search.getUncompletedCourses(page, item);
        courses = courses.filter((course) => course.progress != "full");
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
                console.warn("not support ", course.type);
                continue;
            }

            let t = page
                .locator(`#${course.id}`)
                .getByText(course.title, { exact: true })
                .first();
            try {
                if (
                    (await t.getAttribute("class"))!!.lastIndexOf("locked") !=
                    -1
                ) {
                    console.log("is locked", "skip");
                    continue;
                }
            } catch {}

            await t.click({ timeout: 0 });

            await page.waitForURL(RegExp(`^${Search.courseUrl}.*`), {
                timeout: 0,
                waitUntil: "domcontentloaded"
            });

            // const courType = await ExecStrategy.checkCourseType(page);

            for (let count = 5; count > -1; count--) {
                try {
                    await strategy(page, course.progress);
                    break;
                } catch (e) {
                    console.error(e);
                    console.log("exec strategy error: retry", count);
                    await page.reload({ timeout: 0 });
                }
            }
            // 回到课程选择页
            await page.goBack({
                timeout: 0,
                waitUntil: "domcontentloaded"
            });
            await page.reload({ timeout: 0, waitUntil: "domcontentloaded" });
            console.debug("go back to course page");
        }
        await page.goBack({
            timeout: 0,
            waitUntil: "domcontentloaded"
        });
    }
    console.log("program end...");
    // Teardown
    await context.close();
})();

async function login(page: Page) {
    await page.getByPlaceholder("请输入登录名").fill(process.env._ACCOUNT!!);
    await page.getByPlaceholder("请输入登录密码").fill(process.env._PASSWORD!!);
    await page.getByRole("button", { name: "登录" }).click();
    // 等待跳转
    await page.waitForURL(homeUrl, { timeout: 0, waitUntil: "load" });
}
