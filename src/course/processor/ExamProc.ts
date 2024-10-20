import { Page } from 'playwright';

import { Processor } from '../Processor.js';

import { CourseProgress, CourseType } from '../Search.js';
import { getExam } from '../../api/exam.js';

export default class ExamProc implements Processor {
  name: CourseType = 'exam';
  condition() {
    return false;
  }

  async exec(page: Page) {
    const r = await getExam(this.getActivttyId(page.url()));
    console.log('标题: ', r['title']);
    console.log('成绩比例: ', r['score_percentage']);
    console.log('题目数: ', r['subjects_count']);
    console.log('提交用时(s): ', r['submitted_times']);
  }

  private getActivttyId(url: string) {
    return Number(url.substring(url.lastIndexOf('/') + 1));
  }
}