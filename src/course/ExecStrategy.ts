import { Page } from 'playwright';
import { expect } from 'playwright/test';
import { CourseProgress } from './Search';
import { waitForSPALoaded } from '../utils.js';

type StrategyFunc = (page: Page, progress: CourseProgress) => Promise<void>;

const COURSE_TYPE = {
  web_link: '线上链接',
  material: '参考资料',
  homework: '作业',
  forum: '讨论',
  online_video: '音视频教材',
  slide: '微课',
  lesson: '录播教材',
  lesson_replay: '教室录播',
  exam: '测试',
  chatroom: 'iSlide 直播',
  classroom: '随堂测试',
  questionnaire: '调查问卷',
  page: '页面',
  scorm: '第三方教材',
  interaction: '互动教材',
  feedback: '教学反馈',
  virtual_classroom: 'Connect 直播',
  zoom: 'Zoom 直播',
  microsoft_teams_meeting: 'Teams 直播',
  webex_meeting: 'Webex 直播',
  welink: 'Welink',
  tencent_meeting: '课堂直播',
  classin: 'ClassIn 直播',
  live_record: '直播',
  select_student: '选人',
  race_answer: '抢答',
  number_rollcall: '数字点名',
  qr_rollcall: '二维码点名',
  dingtalk_meeting: '钉钉会议',
  virtual_experiment: '虚拟仿真实验',
  mix_task: '复合任务',
  unknown: '未知'
};

type CourseType = keyof typeof COURSE_TYPE;

const strategyTable: Partial<Record<CourseType, StrategyFunc>> = {
  online_video: onlineVideoStrategy, // 视频处理策略
  forum: forumStrategy, // 论坛处理策略
  page: pageStrategy, // pdf页处理策略
  tencent_meeting: tencentMeetingStrategy, // 直播处理策略
  material: materialStrategy, // 参考资料处理策略
  exam: examStrategy,
  // unknown: undefined,
  web_link: webLinkStrategy,
  // homework: undefined,
  // slide: undefined,
  // lesson: undefined,
  // lesson_replay: undefined,
  // chatroom: undefined,
  // classroom: undefined,
  // questionnaire: undefined,
  // scorm: undefined,
  // interaction: undefined,
  // feedback: undefined,
  // virtual_classroom: undefined,
  // zoom: undefined,
  // microsoft_teams_meeting: undefined,
  // webex_meeting: undefined,
  // welink: undefined,
  // classin: undefined,
  // live_record: undefined,
  // select_student: undefined,
  // race_answer: undefined,
  // number_rollcall: undefined,
  // qr_rollcall: undefined,
  // dingtalk_meeting: undefined,
  // virtual_experiment: undefined,
  // mix_task: undefined
};

async function examStrategy(page: Page, _: CourseProgress) {

}

async function webLinkStrategy(page: Page, _: CourseProgress) {
  // const id = window.originLiveId
  // https://v.ouchn.cn/live/watch/heartbeat/[liveId]?参数1=值1&参数2=值2&...
  // liveId 获取方式 window.originLiveId 
  // t=时间戳 
  // tid=xylink-live_58e84848652dbc42955dd239990dd20a

  // tid 计算方式
  // const c = {
  //   "clientType": "xylink-live",
  //   "n-ua": "3.10.0"
  // }
  // const generateRequestId = function(clientType) {
  //   return "".concat(clientType, "_").concat(generateUUID())
  // }

  // const generateUUID = function() {
  //   var e = (new Date).getTime();
  //   return "xyxxxxxyxxxxyxxxyxxxxxxxxyxxxxxy".replace(/[xy]/g, function(t) {
  //    var n = (e + 16 * Math.random()) % 16 | 0;
  //    return e = Math.floor(e / 16),
  //    ("x" === t ? n : 3 & n | 8).toString(16)
  //   })
  // }

  // console.log(generateRequestId(c.clientType))

  // videoType=flv 视频格式
  // randomStr=6FQV2WTJXOXCKAF2FX4U8KFOKKMXOME1 随机字符串
  // haveVideoSrc=none 视频源
  // upvoteCount=0 点赞数
  // watchStatus=STAY_VIEW_PAGE	观看状态
  // newFingerPrint2Id=987A416F2314FEB4C93208D0D0A2A1D9 指纹

  // 获取指纹的接口

  // c = n(28)
  // d = Object(c.a)(l, 2)

  // function d() {
  //    return /android|iphone|ipad/.test(c.toLowerCase()) || /Mac|Mac OS/.test(c) ? e : d() && u() && r.a.isStartLiveing ? (console.log("\u5f53\u524d\u4e3awin7\u7cfb\u7edf\u7684ie\uff0c\u4f7f\u7528rtmp\u683c\u5f0f\u64ad\u653e\u3002"),
  //    "rtmp") : u() && r.a.isStartLiveing ? (console.log("\u5f53\u524d\u4e3awin10\u7cfb\u7edf\u7684ie\uff0c\u4f7f\u7528m3u8\u683c\u5f0f\u64ad\u653e\u3002"),
  //    "m3u8") : window.MediaSource && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"') ? "flv" : e
  // }

  // videoType: d("m3u8"),
  //  Re.get("/api/rest/live-audience/external/xylink/audience/v1", {
  //         liveId: e,
  //         videoType: t,
  //         randomStr: n,
  //         areaCode: a,
  //         securityKey: Fe.apiGatewayParams.securityKey,
  //         token: Fe.heartbeatToken
  //     })
  //   }


  // baseURL: //v.ouchn.cn
  // Accept: "application/json, text/plain, */*"
  // Aud-Token: 
  // method: 'get'
  // areaCode: null
  // randomStr: "YYNIEXES3XY2AZGUXTBYGJ96XD2T9JXW"
  // videoType: "flv"

  await waitForSPALoaded(page);
  // await page.waitForLoadState('networkidle');
  try {
    await page.getByText('观看回放').click({timeout: 3000});
  } catch {
    console.log('不支持');
  }
}

async function forumStrategy(page: Page, progress: CourseProgress) {
  // ...就算发帖还是完成一半的状态...可能是国开系统bug...我们直接跳过
  if (progress == 'part') return;
  // 直接复制别人的...
  const topic = page.locator('.forum-topic-detail').first();
  const title = await topic.locator('.topic-title').textContent();
  const content = await topic.locator('.topic-content').textContent();

  const publishBtn = page.getByText('发表帖子');
  await publishBtn.click();

  const form = page.locator('.topic-form-section');
  const titleInput = form.locator('input[name="title"]');
  const contentInput = form.locator('.simditor-body>p');
  await titleInput.fill(title!!);
  await contentInput.fill(content!!);

  await page
    .locator('#add-topic-popup .form-buttons')
    .getByRole('button', { name: '保存' })
    .click();
}

async function pageStrategy(page: Page, _: CourseProgress) {
  await page.waitForTimeout(200);
  const rightScreen = page.locator('div.full-screen-mode-content');
  let scrollH = await rightScreen.evaluate((element) => {
    element.scrollTo({
      left: 0,
      top: element.scrollHeight,
      behavior: 'smooth'
    });
    return element.scrollHeight;
  });

  console.log(`scroll to ${scrollH}`);

  await waitForSPALoaded(page);
  await page.waitForLoadState('networkidle');

  const iframeHtml = page
    .frameLocator('#previewContentInIframe')
    .locator('html');
  try {
    await iframeHtml.waitFor({ state: 'visible', timeout: 7000 });
  } catch {
    // console.warn("not pdf or other? (can't find anything)");
    return;
  }

  scrollH = await iframeHtml.evaluate((element) => {
    element.scrollTo({
      left: 0,
      top: element.scrollHeight,
      behavior: 'smooth'
    });
    return element.scrollHeight;
  });

  console.log(`scroll to ${scrollH}`);
}

async function tencentMeetingStrategy(_: Page, _1: CourseProgress) {
  //TODO:
  console.warn('直播任务', 'skip');
}

async function onlineVideoStrategy(page: Page) {
  const tryToShowControls = async () => {
    const playControls = page.locator('div.mvp-replay-player-all-controls');
    await playControls.evaluate(
      (element) => {
        element.classList.remove('mvp-replay-player-hidden-control');
      },
      {},
      { timeout: 0 }
    );
  };

  await waitForSPALoaded(page);
  await page.waitForLoadState('networkidle');

  await tryToShowControls();

  // check video play over?
  const display = page.locator('div.mvp-time-display');
  const pgs = (await display.textContent({ timeout: 1000 }))!!.split('/');

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
      const progress = display?.textContent!!.split('/');
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

async function materialStrategy(page: Page, _: CourseProgress) {
  await page.waitForSelector('div.activity-material', { state: 'visible' });
  const pdfs = await page.locator('.activity-material a:text("查看")').all();
  for (const pdf of pdfs) {
    await pdf.click();
    await page.waitForLoadState();
    await page.locator('#file-previewer .header > a.close').click();
  }
}

export { StrategyFunc, strategyTable, CourseType, COURSE_TYPE };
