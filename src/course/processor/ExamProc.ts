import { Page } from 'playwright';

import { Processor } from '../processor.js';

import { CourseInfo, CourseType } from '../search.js';
import Exam from '../../api/Exam.js';

export default class ExamProc implements Processor {
  name: CourseType = 'exam';

  async condition(info: CourseInfo) {
    console.log(info.activityId);
    const exam = new Exam(info.activityId);
    const r = await exam.get();
    console.log('标题: ', r['title']);
    console.log('成绩比例: ', r['score_percentage']);
    console.log('题目数: ', r['subjects_count']);
    console.log('提交用时(s): ', r['submitted_times']);
    return false;
  }

  async exec(page: Page) {}
}
