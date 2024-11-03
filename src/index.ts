import {chromium} from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import 'source-map-support/register.js';

import * as Activity from './activity.js';
import * as Processor from './course/processor.js';
import * as Search from './course/search.js';
import {waitForSPALoaded} from './utils.js';
import Config from './config.js';
import {login} from './login.js';
import AIModel from './ai/AIModel.js';
import {format} from 'util';
import chalk from 'chalk';
import {sleep} from "openai/core.js";

(async () => {
    await AIModel.init();

    const browser = await chromium.use(StealthPlugin()).launch({
        executablePath: process.env._CHROME_DEV!,
        headless: false,
        slowMo: 5500 // 搞太快会限制访问
    });

    const page = await login(browser);

    await page.getByRole('link', {name: '我的课程'}).click();
    await waitForSPALoaded(page);

    const listItems = await Activity.getActivities(page);

    console.log('课程组数量: ', listItems.length);

    for (let item of listItems) {
        console.log('-'.repeat(60));
        console.log(item.title, item.percent);

        // 考试需要特殊处理
        const courses = (await Search.getUncompletedCourses(page, item)).filter(
            (course) => course.progress != 'full' || course.type == 'exam'
        );

        for (const [i, course] of courses.entries()) {
            console.log(
                chalk.bgBlueBright(
                    format(
                        '%s %s %s : %d/%d',
                        course.syllabusName ?? course.moduleName,
                        course.activityName,
                        course.progress,
                        i + 1,
                        courses.length
                    )
                )
            );

            const processor = Processor.getProcessor(course.type);
            if (!processor) {
                console.warn(
                    '不支持的课程类型:',
                    Processor.getCourseType(course.type),
                    '\n'
                );
                continue;
            }

            if (processor.condition && !(await processor.condition(course))) {
                continue;
            }

            let tLoc = page.locator(`#${course.moduleId}`);
            if (course.syllabusId) {
                tLoc = tLoc.locator(`#${course.syllabusId}`);
            }

            const t = (await tLoc
                .getByText(course.activityName, {exact: true})
                .elementHandles())!;

            for (const es of t) {
                if ((await es.getAttribute('class'))!.lastIndexOf('locked') != -1) {
                    // 延迟1.5秒
                    await sleep(1500)
                    console.log('课程锁定', '跳过');
                    continue;
                }

                if (await es.$('xpath=../*[contains(@class, "upcoming")]')) {
                    // 延迟1.5秒
                    await sleep(1500)
                    console.log('课程未开始', '跳过');
                    continue;
                }

                await es.click();

                await page.waitForURL(RegExp(`^${Config.urls.course()}.*`), {
                    timeout: 30000,
                    waitUntil: 'domcontentloaded'
                });

                for (let count = 5; count > -1; count--) {
                    await waitForSPALoaded(page);
                    try {
                        await processor?.exec(page);
                        break;
                    } catch (e) {
                        console.error(e);
                        console.log('process course failed: retry', count);
                        await page.reload({timeout: 1000 * 60});
                    }
                }

                // 回到课程选择页
                await page.goBack({
                    timeout: 0,
                    waitUntil: 'domcontentloaded'
                });
                await page.reload({
                    timeout: 10000,
                    waitUntil: 'domcontentloaded'
                });
            }
            // console.debug("go back to course page");
        }
        await page.goBack({
            timeout: 0,
            waitUntil: 'domcontentloaded'
        });
    }
    console.log('program end...');
    // Teardown
    await browser.close();
})();
