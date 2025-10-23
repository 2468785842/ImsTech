import { expect } from '@playwright/test';
import { Page } from 'playwright';

import ProgressBar from 'progress';

import { CourseType, Processor } from '../processor.js';

import { waitForSPALoaded } from '../../utils.js';
import Config from '../../config.js';

export default class OnlineVideoProc implements Processor {
  name: CourseType = 'online_video';

  async exec(page: Page) {
    let checkVideoStatusTimer: any = null;
    const tryToShowControls = async () => {
      const playControls = page.locator('div.mvp-replay-player-all-controls');
      await playControls.evaluate(
        (element) => {
          element.classList.remove('mvp-replay-player-hidden-control');
        },
        {},
        { timeout: 1000 * 60 },
      );
    };

    await waitForSPALoaded(page);

    await page.waitForTimeout(3000);

    let mediaType: 'video' | 'audio' | '' = '';

    if (await page.locator('video').count()) {
      mediaType = 'video';
      await tryToShowControls();
    } else if (await page.locator('audio').count()) {
      mediaType = 'audio';
    } else {
      console.log('未知原因加载失败: 跳过');
      return;
    }

    console.log('mediaType', mediaType);

    await page.evaluate(
      `document.getElementsByTagName("${mediaType}")[0].playbackRate = ${Config.playRate}`,
    );

    const getMeidaTime = async () => {
      let start: string, end: string;
      if (mediaType === 'video') {
        const display = page.locator('div.mvp-time-display');
        [start, end] = (await display.textContent())!.split('/');
      } else {
        start = (await page.locator('.current-time').textContent())!;
        end = (await page.locator('.duration').textContent())!;
      }
      return [start.trim(), end.trim()];
    };

    const [start, end] = await getMeidaTime();

    console.log('play progress: ', start, end);

    // check media play over?
    if (start == end && end != '00:00') {
      return;
    }

    if (mediaType === 'video') {
      await tryToShowControls();

      // 静音 mvp-fonts mvp-fonts-volume-on
      const ctlVol = page.locator('button.mvp-volume-control-btn');
      if (await ctlVol.locator('i.mvp-fonts-volume-on').isVisible()) {
        await ctlVol.click();
        console.log('volume off');
      }

      try {
        await page.locator('.mvp-player-quality-menu').hover({ timeout: 500 });
        // 改变视频画质省流
        await page.getByText('480p').click({ timeout: 500 });
        console.log('change quality to 480p');
      } catch {
        console.warn('no have quality menu', 'skip');
      }

      // 点击播放
      const p = page.locator('.mvp-toggle-play.mvp-first-btn-margin');
      await expect(p).toBeVisible({ timeout: 500 });
      await p.click();
    } else {
      await page.locator('.play').click();
      await page.locator('.volume').click();
    }

    const prcsBar = this.createProgress(
      this.timeStringToNumber(start),
      this.timeStringToNumber(end),
    );

    let onCur: any = 0;
    //检测视频是否卡住
    const checkVideoPlayStatusFunc = () => {
      let saveCur = onCur;
      try {
        clearTimeout(checkVideoStatusTimer);
        checkVideoStatusTimer = setTimeout(async function () {
          if (saveCur == onCur) {
            //console.warn('Video playback may be stuck at:', saveCur);
            let p = page.locator('.mvp-toggle-play.mvp-first-btn-margin');
            //查找播放按钮元素，如果存在则目前为暂停状态，设置playStatus为false
            let playStatus: any = false;
            try {
              playStatus = await page.evaluate(() =>
                document.querySelector(
                  '.mvp-toggle-play.mvp-first-btn-margin i.mvp-fonts.mvp-fonts-play',
                ),
              );
            } catch (e) {
              playStatus = true;
            }
            playStatus = !playStatus || playStatus == null ? true : false;
            try {
              if (playStatus == true) {
                //console.log("目前为视频播放状态，执行暂停视频并重新开始播放");
                p = page.locator('.mvp-toggle-play.mvp-first-btn-margin');
                console.log(p);
                try {
                  await page.evaluate(() => {
                    let btnC = document.querySelector(
                      '.mvp-toggle-play.mvp-first-btn-margin',
                    ) as HTMLElement;
                    if (btnC) {
                      btnC.click();
                    }
                  });
                  await page.waitForTimeout(500);
                  await page.evaluate(() => {
                    let btnC = document.querySelector(
                      '.mvp-toggle-play.mvp-first-btn-margin',
                    ) as HTMLElement;
                    if (btnC) {
                      btnC.click();
                    }
                  });
                } catch (clickError) {
                  //console.log("点击操作超时，尝试重新定位元素");
                  p = page.locator('.mvp-toggle-play.mvp-first-btn-margin');
                  await p.click().catch(async () => {
                    //console.log("重试点击也失败了，尝试刷新页面");
                    if (page) {
                      try {
                        await page.reload({ timeout: 10000 });
                        await page.waitForLoadState('domcontentloaded');
                        //console.log("页面刷新完成");
                        return checkVideoPlayStatusFunc();
                      } catch (reloadError) {
                        //console.log("页面刷新失败:", reloadError);
                        return checkVideoPlayStatusFunc();
                      }
                    }
                  });
                }
              } else {
                p = page.locator('.mvp-toggle-play.mvp-first-btn-margin');
                //console.log("目前为视频暂停状态，点击开始播放");
                try {
                  await page.evaluate(() => {
                    let btnC = document.querySelector(
                      '.mvp-toggle-play.mvp-first-btn-margin',
                    ) as HTMLElement;
                    if (btnC) {
                      btnC.click();
                    }
                  });
                } catch (clickError) {
                  //console.log("点击操作超时");
                  return checkVideoPlayStatusFunc();
                }
              }
            } catch (e) {
              //console.log("操作视频播放暂停失败:", e);
              return checkVideoPlayStatusFunc();
            }
          } else {
            //继续检测
            //console.log("视频正在播放无需操作，继续检测");
            return checkVideoPlayStatusFunc();
          }
          checkVideoPlayStatusFunc();
        }, 10000);
      } catch (e) {
        checkVideoPlayStatusFunc();
      }
    };
    //执行视频播放状态检测
    checkVideoPlayStatusFunc();

    let preCur = (await getMeidaTime())[0];

    const updatePrcsBar = async () => {
      const cur = (await getMeidaTime())[0];
      onCur = cur;
      if (preCur != cur) {
        prcsBar.tick(
          this.timeStringToNumber(cur) - this.timeStringToNumber(preCur),
        );
        preCur = cur;
      }
    };

    const timer = setInterval(updatePrcsBar, 1000);

    //一直等待直到视频播放完毕
    await page.waitForFunction(
      ({ date, mediaType }) => {
        let cur: string, end: string;
        // 此为浏览器环境
        if (mediaType === 'video') {
          const display = document.querySelector(
            'div.mvp-time-display',
          ) as HTMLElement;
          // start duration / end duration
          // example: 23:11 / 36:11
          [cur, end] = display.textContent!.split('/');
        } else {
          cur = (document.querySelector('.current-time') as HTMLElement)
            .textContent!;
          end = (document.querySelector('.duration') as HTMLElement)
            .textContent!;
        }
        cur = cur.trim();
        end = end.trim();
        if (Date.now() - date > 15000 && (cur == '00:00' || cur == ''))
          throw '播放媒体文件错误(等待超时)';
        return cur === end;
      },
      { date: Date.now(), mediaType },
      { timeout: 0, polling: 1000 },
    );

    clearInterval(timer);
    clearTimeout(checkVideoStatusTimer); //删除视频播放状态检测计时器
    updatePrcsBar();
  }

  private createProgress(cur: number, end: number) {
    const bar = new ProgressBar('正在播放 [:bar] :percent :current/:total(s)', {
      head: '>',
      incomplete: ' ',
      total: end,
      width: 30,
      clear: true,
    });
    bar.render((tokens: any) => {
      const elapsed = this.timeNumberToString(tokens.current);
      const total = this.timeNumberToString(tokens.total);
      process.stdout.write(
        `\r播放中 [${tokens.bar}] ${tokens.percent}% ${elapsed} / ${total}`,
      );
    });
    bar.tick(cur);
    return bar;
  }

  private timeNumberToString(sec: number) {
    const h = Math.floor(sec / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private timeStringToNumber(timeString: string): number {
    const parts = timeString.split(':').map(Number);

    if (parts.some((part) => isNaN(part) || part < 0)) {
      throw new Error(
        'Invalid time values. Each part must be a non-negative number.',
      );
    }

    let hours = 0,
      minutes = 0,
      seconds = 0;

    if (parts.length === 3) {
      [hours, minutes, seconds] = parts;
    } else if (parts.length === 2) {
      [minutes, seconds] = parts;
    } else if (parts.length === 1) {
      [seconds] = parts;
    } else {
      throw new Error('Invalid time format. Use HH:MM:SS, MM:SS, or SS.');
    }

    if (minutes >= 60 || seconds >= 60) {
      throw new Error('Minutes and seconds should be less than 60.');
    }

    return hours * 3600 + minutes * 60 + seconds;
  }
}
