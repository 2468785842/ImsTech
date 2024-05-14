import { Page } from 'playwright';
import { expect } from 'playwright/test';

type CourseType =
    | 'video'
    | 'forum'
    | 'page'
    | 'liveStream'
    | 'exam'
    | 'unknown';

type StrategyFun = (page: Page) => Promise<void>;

const strategyTable: [CourseType, StrategyFun][] = [
    ['video', videoStrategy], // 视频处理策略
    ['forum', forumStrategy], // 论坛处理策略
    ['page', pageStrategy], // pdf页处理策略
    ['liveStream', liveStreamStrategy], // 直播处理策略
    ['exam', examStrategy], // 考试处理策略
    [
        'unknown',
        async () => {
            console.log('unknown', 'not support');
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
    throw 'unexpected error';
}

async function forumStrategy(page: Page) {
    //TODO
    console.warn('论坛任务', 'skip');
}

async function pageStrategy(page: Page) {
    //TODO
    console.log('查看文档');
}

async function liveStreamStrategy(page: Page) {
    //TODO
    console.warn('直播任务', 'skip');
}

async function examStrategy(page: Page) {
    //TODO
    console.warn('考试任务', 'skip');
}

async function videoStrategy(page: Page) {
    while (true) {
        // 点击播放
        try {
            const p = page.locator('i.mvp-fonts.mvp-fonts-play');
            await expect(p).toBeVisible({ timeout: 100000 });
            await p.click();
        } catch (e) {
            //刷新页面 重试
            console.error(e);
            console.warn('retry: load video failed', 'reload page');
            await page.reload();
            continue;
        }
        break;
    }
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
            console.log('waiting for video play over:', cur, progress);
            return cur == endProgress;
        },
        progress[1].trim(),
        { timeout: 0, polling: 1000 }
    );
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

export {
    getStrategy,
    checkCurrentCourseItem,
    CourseType,
    StrategyFun,
    strategyTable
};
