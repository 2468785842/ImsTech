import { Page } from 'playwright';

import { CourseType, Processor } from '../Processor.js';

export default class TencentMeetingProc implements Processor {
  name: CourseType = 'tencent_meeting';

  async exec(_: Page) {
    //TODO:
    console.warn('直播任务', 'skip');
  }
}
