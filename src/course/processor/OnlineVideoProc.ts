import { expect } from '@playwright/test';
import { Page } from 'playwright';

import { CourseType, Processor } from '../Processor.js';

import { waitForSPALoaded } from '../../utils.js';

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
        { timeout: 30000 }
      );
    };

    await waitForSPALoaded(page);
    await page.waitForLoadState('networkidle');

    await tryToShowControls();

    // check video play over?
    const display = page.locator('div.mvp-time-display');
    const pgs = (await display.textContent({ timeout: 1000 }))!.split('/');

    console.log('play progress: ', pgs[0].trim(), pgs[1].trim());

    if (pgs[0].trim() == pgs[1].trim() && pgs[1].trim() != '00:00') {
      return;
    }

    await tryToShowControls();
    // 静音 mvp-fonts mvp-fonts-volume-on
    const ctlVol = page.locator('button.mvp-volume-control-btn');
    if (await ctlVol.locator('i.mvp-fonts-volume-on').isVisible()) {
      await ctlVol.click();
      console.log('volume off');
    }

    await tryToShowControls();
    try {
      await page.locator('.mvp-player-quality-menu').hover({ timeout: 500 });
      // 改变视频画质省流
      await page.getByText('480p').click({ timeout: 500 });
      console.log('change quality to 480p');
    } catch {
      console.warn('no have quality menu', 'skip');
    }

    await tryToShowControls();
    // 点击播放
    const p = page.locator('.mvp-toggle-play.mvp-first-btn-margin');
    await expect(p).toBeVisible({ timeout: 500 });
    await p.click();

    console.log('play');

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
      { timeout: 0, polling: 500 }
    );
  }
}
