import { Page } from "playwright";
import { expect } from "playwright/test";
import { CourseProgress, CourseType } from "./Search";
import { waitForSPALoaded } from '../utils.js';

type StrategyFun = (page: Page, progress: CourseProgress) => Promise<void>;

const strategyTable: Record<CourseType, StrategyFun | undefined> = {
    video: videoStrategy, // 视频处理策略
    forum: forumStrategy, // 论坛处理策略
    page: pageStrategy, // pdf页处理策略
    liveStream: liveStreamStrategy, // 直播处理策略
    material: materialStrategy, // 参考资料处理策略
    exam: undefined,
    unknown: undefined
};

async function forumStrategy(page: Page, progress: CourseProgress) {
    // ...就算发帖还是完成一半的状态...可能是国开系统bug...我们直接跳过
    if (progress == "part") return;
    // 直接复制别人的...
    const topic = page.locator(".forum-topic-detail").first();
    const title = await topic.locator(".topic-title").textContent();
    const content = await topic.locator(".topic-content").textContent();

    const publishBtn = page.getByText("发表帖子");
    await publishBtn.click();

    const form = page.locator(".topic-form-section");
    const titleInput = form.locator('input[name="title"]');
    const contentInput = form.locator(".simditor-body>p");
    await titleInput.fill(title!!);
    await contentInput.fill(content!!);

    await page
        .locator("#add-topic-popup .form-buttons")
        .getByRole("button", { name: "保存" })
        .click();
}

async function pageStrategy(page: Page, _: CourseProgress) {
    await page.waitForTimeout(200);
    const rightScreen = page.locator("div.full-screen-mode-content");
    let scrollH = await rightScreen.evaluate((element) => {
        element.scrollTo({
            left: 0,
            top: element.scrollHeight,
            behavior: "smooth"
        });
        return element.scrollHeight;
    });

    console.log(`scroll to ${scrollH}`)

    await waitForSPALoaded(page)
    await page.waitForLoadState('networkidle')

    const iframeHtml = page
        .frameLocator("#previewContentInIframe")
        .locator("html");
    try {
        await iframeHtml.waitFor({ state: "visible", timeout: 7000 });
    } catch {
        console.warn("not pdf or other? (can't find anything)");
        return;
    }

    scrollH = await iframeHtml.evaluate((element) => {
        element.scrollTo({
            left: 0,
            top: element.scrollHeight,
            behavior: "smooth"
        });
        return element.scrollHeight;
    });

    console.log(`scroll to ${scrollH}`)
}

async function liveStreamStrategy(_: Page, _1: CourseProgress) {
    //TODO:
    console.warn("直播任务", "skip");
}

async function videoStrategy(page: Page) {
    const tryToShowControls = async () => {
        const playControls = page.locator("div.mvp-replay-player-all-controls");
        await playControls.evaluate((element) => {
            element.classList.remove("mvp-replay-player-hidden-control");
        }, {}, { timeout: 0 });
    };

    await waitForSPALoaded(page);
    await page.waitForLoadState('networkidle')

    await tryToShowControls();

    // check video play over?
    const display = page.locator("div.mvp-time-display");
    const pgs = (await display.textContent({ timeout: 1000 }))!!.split("/");

    console.log("play progress: ", pgs[0].trim(), pgs[1].trim());

    if (pgs[0].trim() == pgs[1].trim() && pgs[1].trim() != "00:00") {
        return;
    }

    await tryToShowControls();
    // 静音 mvp-fonts mvp-fonts-volume-on
    const ctlVol = page.locator("button.mvp-volume-control-btn");
    if (await ctlVol.locator("i.mvp-fonts-volume-on").isVisible()) {
        await ctlVol.click();
        console.log("volume off");
    }

    await tryToShowControls();
    try {
        await page.locator(".mvp-player-quality-menu").hover({ timeout: 500 });
        // 改变视频画质省流
        await page.getByText("480p").click({ timeout: 500 });
        console.log("change quality to 480p");
    } catch {
        console.warn("no have quality menu", "skip");
    }

    await tryToShowControls();
    // 点击播放
    const p = page.locator(".mvp-toggle-play.mvp-first-btn-margin");
    await expect(p).toBeVisible({ timeout: 500 });
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
        { timeout: 0, polling: 500 }
    );
}

async function materialStrategy(page: Page, _: CourseProgress) {
    await page.waitForSelector("div.activity-material", { state: "visible" });
    const pdfs = await page.locator('.activity-material a:text("查看")').all();
    for (const pdf of pdfs) {
        await pdf.click();
        await page.waitForLoadState();
        await page.locator("#file-previewer .header > a.close").click();
    }
}

/**
 * 判断当前课程类型
 */ 
async function checkCourseType(page: Page): Promise<CourseType> {
    // .online-video-box 视频
    // .page-box 电子教材
    // .forum-box 课后讨论
    // .tencent-meeting-box 直播
    // .exam-basic-info 考试
    // .exam-activity-box 专题测验
    // .material-box 考核说明
    await page.waitForSelector("div.activity-content-box", {
        state: "visible",
        timeout: 0
    });

    const videoLocator = page.locator("div.online-video-box");
    const pageLocator = page.locator("div.page-box");
    const forumLocator = page.locator("div.forum-box");
    const liveStreamLocator = page.locator("div.tencent-meeting-box");
    const examLocator = page.locator("div.exam-basic-info");
    const materialLocator = page.locator("div.material-box");

    if (await videoLocator.isVisible()) return "video";
    if (await pageLocator.isVisible()) return "page";
    if (await forumLocator.isVisible()) return "forum";
    if (await liveStreamLocator.isVisible()) return "liveStream";
    if (await examLocator.isVisible()) return "exam";
    if (await materialLocator.isVisible()) return "material";
    return "unknown";
}

export { checkCourseType, CourseType, StrategyFun, strategyTable };
