import { chromium, ElementHandle, Page } from 'playwright';
import { expect } from 'playwright/test';
import 'dotenv/config';

type CourseType =
    | 'video'
    | 'forum'
    | 'page'
    | 'liveStream'
    | 'exam'
    | 'unknown';

interface CourseInfo {
    title: string;
    semester: string;
    code: string;
    startDate: string;
    percent: string;
}

const homeUrl = 'https://lms.ouchn.cn/user/index#/';
const coursesUrl = 'https://lms.ouchn.cn/user/courses#/';
const loginUrl = `https://iam.pt.ouchn.cn/am/UI/Login`;
const courseUrl = 'https://lms.ouchn.cn/course/';

(async () => {
    // Setup
    const context = await chromium.launchPersistentContext(
        'C:\\ChromiumCache',
        {
            //facking... because chromuim not support h.264,so need replace,
            executablePath: process.env._ChromeDev,
            headless: false,
            screen: {
                width: 1920,
                height: 1080
            },
            slowMo: 100,
            bypassCSP: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--start-maximized'
            ] //关闭自动控制特征
        }
    );
    let page = context.pages()[0];
    // setInterval(() => {
    //     //保持窗口始终聚焦
    //     page.evaluate('window.focus();');
    // }, 200);
    await page.goto(homeUrl);
    // 判断是否登录
    await page
        .waitForURL(RegExp(`^${loginUrl}.*`), { timeout: 2000 })
        .then(async () => {
            console.log('to login');
            await login(page);
        })
        .catch(() => {
            console.log('is login');
        });

    await page.getByRole('link', { name: '我的课程' }).click();
    await page.waitForURL(coursesUrl, { timeout: 0, waitUntil: 'load' });
    const listItems = await getCourses(page);
    for (let item of listItems) {
        const activities = await getUnfinishActivities(page, item);
        for (let title of activities) {
            await page.getByText(title).click();
            await page.waitForURL(RegExp(`^${courseUrl}.*`), {
                timeout: 0,
                waitUntil: 'load'
            });
            // div.activity-content-bd.online-video-box 视频
            // div.activity-content-bd.page-box 电子教材
            // div.activity-content-bd.forum-box 课后讨论
            const courType = await checkCurrentCourseItem(page);
            console.log(title, ':', courType);
            if (courType != 'video') {
                // 回到课程选择页
                await page.goBack({
                    timeout: 0,
                    waitUntil: 'load'
                });
                continue;
            }
            // 点击播放
            await page.locator('i.mvp-fonts.mvp-fonts-play').click();
            // 静音mvp-fonts mvp-fonts-volume-on
            const ctlVol = page.locator('button.mvp-volume-control-btn');
            if (await ctlVol.locator('i.mvp-fonts-volume-on').isVisible()) {
                await ctlVol.click();
            }
            await page.locator('.mvp-player-quality-menu').hover();
            // 改变视频画质省流
            await page.getByText('480p').click();
            // 获取视频时长
            const mvpTimeDisplay = page.locator('div.mvp-time-display');
            // start duration / end duration
            // example: 23:11 / 36:11
            const progress = (await mvpTimeDisplay.innerText()).split('/');
            //一直等待直到视频播放完毕
            await page.waitForFunction(
                (endProgress) => {
                    // 此为浏览器环境
                    const display = document.querySelector(
                        'div.mvp-time-display'
                    ) as HTMLElement;
                    const cur = display?.innerText.split('/')[0].trim();
                    return cur == endProgress;
                },
                progress[1].trim(),
                { timeout: 0, polling: 1000 }
            );
            // 回到课程选择页
            await page.goBack({
                timeout: 0,
                waitUntil: 'load'
            });
        }
    }
    // Teardown
    await context.close();
})();

async function login(page: Page) {
    await page.getByPlaceholder('请输入登录名').fill(process.env._ACCOUNT!!);
    await page.getByPlaceholder('请输入登录密码').fill(process.env._PASSWORD!!);
    await page.getByRole('button', { name: '登录' }).click();
    // 等待跳转
    await page.waitForURL(homeUrl, { timeout: 0, waitUntil: 'load' });
}

async function getCourses(page: Page): Promise<CourseInfo[]> {
    const olSelector = await page.waitForSelector('ol.courses');
    const liElements = await olSelector.$$('li');
    return await Promise.all(
        liElements.map(async (li: ElementHandle) => {
            // 标题
            const title = await (await li.$('div.course-title'))!!.innerText();
            // 学期
            const semester = await (await li.$(
                'div.course-academic-year-semester'
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
                'section.percent span[ng-bind="course.completeness + \'%\'"]'
            ))!!.innerText();

            return { title, semester, code, startDate, percent };
        })
    );
}

async function getUnfinishActivities(
    page: Page,
    coursesInfo: CourseInfo
): Promise<string[]> {
    let strs: string[] = [];
    console.log('获取未完成的活动: ', coursesInfo.title);
    await page.getByRole('link', { name: coursesInfo.title }).click();
    await page.waitForURL(RegExp(`^${courseUrl}.*`));
    await page.waitForTimeout(100);
    await page.locator('input[type="checkbox"]').check();
    try {
        const expand = page.getByText('全部展开');
        await expect(expand).toBeVisible({ timeout: 1000 });
        expand.click();
    } catch {
        console.log('没有??全部展开按钮,可能已经展开?');
    }

    //多个课程组
    await page
        .locator('div.learning-activities:not(.ng-hide)')
        .elementHandles()
        .then(async (elements) => {
            for (const element of elements) {
                //课程
                const activities = await element.$$(
                    'div.learning-activity:not(.ng-hide)'
                );
                await Promise.all(
                    activities.map(async (activity: ElementHandle) => {
                        const title = await activity.$(
                            'div.activity-title a.title'
                        );
                        if (title) {
                            strs.push(await title.innerText());
                        }
                    })
                );
            }
        });
    return strs;
}

// 判断当前课程类型
async function checkCurrentCourseItem(page: Page): Promise<CourseType> {
    // div.activity-content-bd.online-video-box 视频
    // div.activity-content-bd.page-box 电子教材
    // div.activity-content-bd.forum-box 课后讨论
    // div.activity-content-bd.tencent-meeting-box 直播
    // div.exam-basic-info 考试
    await page.waitForSelector('div.activity-content-bd', {
        state: 'attached'
    });
    const videoLocator = page.locator(
        'div.activity-content-bd.online-video-box'
    );
    const pageLocator = page.locator('div.activity-content-bd.page-box');
    const forumLocator = page.locator('div.activity-content-bd.forum-box');
    const liveStreamLocator = page.locator(
        'div.activity-content-bd.tencent-meeting-box'
    );
    const examLocator = page.locator('div.exam-basic-info');

    const [
        isVideoVisible,
        isPageVisible,
        isForumVisible,
        isLiveStreamVisible,
        isExamVisiable
    ] = await Promise.all([
        videoLocator.isVisible(),
        pageLocator.isVisible(),
        forumLocator.isVisible(),
        liveStreamLocator.isVisible(),
        examLocator.isVisible()
    ]);

    if (isVideoVisible) return 'video';
    if (isPageVisible) return 'page';
    if (isForumVisible) return 'forum';
    if (isLiveStreamVisible) return 'liveStream';
    if (isExamVisiable) return 'exam';
    return 'unknown';
}
