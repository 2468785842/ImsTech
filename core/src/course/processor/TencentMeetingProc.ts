import { Page } from 'playwright';

import { CourseType, Processor } from '../processor.js';
import { CourseInfo } from '../search.js';

export default class TencentMeetingProc implements Processor {
  name: CourseType = 'tencent_meeting';
  async condition(_: CourseInfo) {
    console.warn('直播任务', 'skip');
    return false;
  }

  async exec(_: Page) {
    //TODO:
  }
}
