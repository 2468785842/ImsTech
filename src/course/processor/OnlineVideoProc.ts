import { expect } from '@playwright/test';
import { Page } from 'playwright';

import ProgressBar from 'progress';

import { CourseType, Processor } from '../processor.js';

import { waitForSPALoaded } from '../../utils.js';

// 以后考虑直接调用接口, 不播放视频
// {start: 233, end: 286}
// https://lms.ouchn.cn/api/course/activities-read/60005178469

export default class OnlineVideoProc implements Processor {
  name: CourseType = 'online_video';

  async exec(page: Page) {
    const tryToShowControls = async () => {
      const playControls = page.locator('div.mvp-replay-player-all-controls');
      await playControls.evaluate(
        (element) => {
          element.classList.remove('mvp-replay-player-hidden-control');
        },
        {},
        { timeout: 1000 * 60 }
      );
    };

    await waitForSPALoaded(page);

    if (
      (await page
        .locator('video')
        .innerHTML({ timeout: 1000 })
        .catch(() => '')) == ''
    ) {
      console.log('未知原因加载失败: 跳过');
      return;
    }

    await tryToShowControls();

    const playRate = 16;
    await page.evaluate(
      `document.getElementsByTagName("video")[0].playbackRate = ${playRate}`
    );
    console.log(playRate, '倍速');

    const getVideoTime = async () => {
      const display = page.locator('div.mvp-time-display');
      let [start, end] = (await display.textContent({ timeout: 1000 }))!.split(
        '/'
      );

      return [start.trim(), end.trim()];
    };

    const [start, end] = await getVideoTime();

    console.log('play progress: ', start, end);

    // check video play over?
    if (start == end && end != '00:00') {
      return;
    }

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

    const prcsBar = this.createProgress(
      this.timeToMinutes(start) * 60,
      this.timeToMinutes(end) * 60
    );

    let preCur = (await getVideoTime())[0];
    const timer = setInterval(async () => {
      const cur = (await getVideoTime())[0];
      if (preCur != cur) {
        prcsBar.tick(
          (this.timeToMinutes(cur) - this.timeToMinutes(preCur)) * 60
        );
        preCur = cur;
      }
    }, 1000);

    //一直等待直到视频播放完毕
    await page.waitForFunction(
      (date) => {
        // 此为浏览器环境
        const display = document.querySelector(
          'div.mvp-time-display'
        ) as HTMLElement;
        // start duration / end duration
        // example: 23:11 / 36:11
        const progress = display.textContent!.split('/');
        const cur = progress[0].trim();
        const end = progress[1].trim();

        if (Date.now() - date > 15000 && (cur == '00:00' || cur == ''))
          throw 'play video error';
        // console.log("waiting for video play over:", cur, end);
        return cur == end;
      },
      Date.now(),
      { timeout: 0, polling: 1000 }
    );

    clearInterval(timer);
  }

  private createProgress(cur: number, end: number) {
    const bar = new ProgressBar('playing [:bar] :percent :current/:total(s)', {
      head: '>',
      incomplete: ' ',
      total: end,
      width: 30,
      clear: true,
      callback: () => console.log('play finished')
    });
    bar.tick(cur);
    return bar;
  }

  private timeToMinutes(timeString: string) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
