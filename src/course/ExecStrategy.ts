import { Page } from "playwright";
import { expect } from "playwright/test";

type CourseType =
    | "video"
    | "forum"
    | "page"
    | "liveStream"
    | "exam"
    | "unknown"; // TODO: 调查问卷, 线上连接

type StrategyFun = (page: Page) => Promise<void>;

const strategyTable: [CourseType, StrategyFun][] = [
    ["video", videoStrategy], // 视频处理策略
    ["forum", forumStrategy], // 论坛处理策略
    ["page", pageStrategy], // pdf页处理策略
    ["liveStream", liveStreamStrategy], // 直播处理策略
    ["exam", examStrategy], // 考试处理策略
    [
        "unknown",
        async () => {
            console.log("unknown", "not support");
        }
    ]
];

function getStrategy(courType: CourseType): StrategyFun {
    for (let strategy of strategyTable) {
        if (strategy[0] == courType) {
            return strategy[1];
        }
    }
    // impossible exec to here
    throw "unexpected error";
}

async function forumStrategy(page: Page) {
    //TODO:
    console.warn("论坛任务", "skip");
}

async function pageStrategy(page: Page) {
    //TODO:
    console.log("查看文档");
}

async function liveStreamStrategy(page: Page) {
    //TODO:
    console.warn("直播任务", "skip");
}

async function examStrategy(page: Page) {
    //TODO:
    console.warn("考试任务", "skip");
}

async function videoStrategy(page: Page) {
    const tryToShowControls = async () => {
        const playControls = page.locator("div.mvp-replay-player-all-controls");
        await playControls.evaluate((element) => {
            element.classList.remove("mvp-replay-player-hidden-control");
        });
    };

    await tryToShowControls();

    // check video play over?
    const display = page.locator("div.mvp-time-display");
    const pgs = (await display?.textContent({ timeout: 3000 }))!!.split("/");
    console.log("check is over", pgs[0].trim(), pgs[1].trim());
    if (pgs[0].trim() == pgs[1].trim() && pgs[1].trim() != "00:00") {
        return;
    }

    await tryToShowControls();
    // 静音mvp-fonts mvp-fonts-volume-on
    const ctlVol = page.locator("button.mvp-volume-control-btn");
    if (await ctlVol.locator("i.mvp-fonts-volume-on").isVisible()) {
        await ctlVol.click();
        console.log("volume off");
    }

    await tryToShowControls();
    try {
        await page.locator(".mvp-player-quality-menu").hover();
        // 改变视频画质省流
        await page.getByText("480p").click({ timeout: 1000 });
        console.log("change quality to 480p");
    } catch {
        console.warn("no have quality menu", "skip");
    }

    await tryToShowControls();
    // 点击播放
    const p = page.locator(".mvp-toggle-play.mvp-first-btn-margin");
    await expect(p).toBeVisible({ timeout: 5000 });
    await p.click();
    console.log("play");
    //一直等待直到视频播放完毕
    await page.waitForFunction(
        (date) => {
            // 此为浏览器环境
            const display = document.querySelector(
                "div.mvp-time-display"
            ) as HTMLElement;
            // start duration / end duration
            // example: 23:11 / 36:11
            const progress = display?.textContent!!.split("/");
            const cur = progress[0].trim();
            const end = progress[1].trim();

            if (Date.now() - date > 15000 && (cur == "00:00" || cur == ""))
                throw "play video error";
            console.log("waiting for video play over:", cur, end);
            return cur == end;
        },
        Date.now(),
        { timeout: 0, polling: 1000 }
    );
}

// 判断当前课程类型
async function checkCurrentCourseItem(page: Page): Promise<CourseType> {
    // .online-video-box 视频
    // .page-box 电子教材
    // .forum-box 课后讨论
    // .tencent-meeting-box 直播
    // .exam-basic-info 考试
    // .exam-activity-box 专题测验
    await page.waitForSelector("div.activity-content-box", {
        state: "visible",
        timeout: 0
    });
    const videoLocator = page.locator("div.online-video-box");
    const pageLocator = page.locator("div.page-box");
    const forumLocator = page.locator("div.forum-box");
    const liveStreamLocator = page.locator("div.tencent-meeting-box");
    const examLocator = page.locator("div.exam-basic-info");
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

    if (isVideoVisible) return "video";
    if (isPageVisible) return "page";
    if (isForumVisible) return "forum";
    if (isLiveStreamVisible) return "liveStream";
    if (isExamVisiable) return "exam";
    return "unknown";
}

export {
    getStrategy,
    checkCurrentCourseItem,
    CourseType,
    StrategyFun,
    strategyTable
};
