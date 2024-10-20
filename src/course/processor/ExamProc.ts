import { Page } from 'playwright';

import { Processor } from '../processor.js';

import { CourseInfo, CourseProgress, CourseType } from '../search.js';
import Exam from '../../api/Exam.js';

export default class ExamProc implements Processor {
  name: CourseType = 'exam';
  condition(info: CourseInfo) {
    return false;
  }

  async exec(page: Page) {
    const exam = new Exam(this.getActivttyId(page.url()));
    const r = await exam.get();
    console.log('标题: ', r['title']);
    console.log('成绩比例: ', r['score_percentage']);
    console.log('题目数: ', r['subjects_count']);
    console.log('提交用时(s): ', r['submitted_times']);
  }

  private getActivttyId(url: string) {
    return Number(url.substring(url.lastIndexOf('/') + 1));
  }
}
