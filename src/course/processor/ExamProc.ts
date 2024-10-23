import { Page } from 'playwright';

import { Processor } from '../processor.js';

import { CourseInfo, CourseType } from '../search.js';
import Exam from '../../api/Exam.js';

export default class ExamProc implements Processor {
  name: CourseType = 'exam';

  #courseInfo?: CourseInfo;

  async condition(info: CourseInfo) {
    this.#courseInfo = info;
    console.log(info.activityId);
    const exam = new Exam(info.activityId);
    return await this.isSupport(exam);
  }

  async exec(page: Page) {
    console.assert(this.#courseInfo, 'error course info is null');

    if(this.#courseInfo) {
      this.#courseInfo
    }

  }

  private async isSupport(exam: Exam): Promise<boolean> {
    let test = true;

    const examInfo = await exam.get();

    const { submit_times, subjects_count } = examInfo;

    console.log('完成标准:', examInfo['completion_criterion']);
    console.log('标题:', examInfo['title']);
    console.log('成绩比例:', examInfo['score_percentage']);
    console.log('题目数:', examInfo['subjects_count']);
    console.log('允许提交次数:', examInfo['submit_times']);
    console.log('已经提交次数:', examInfo['submitted_times']);

    test = submit_times == 999; // 可提交次数必须足够大, 因为AI答不准
    test = subjects_count < 5; // 题目要少 不然 AI 不行的

    // check subject summary
    const subjectsSummary = await exam.getSubjectsSummary(true);
    const { subjects } = subjectsSummary;

    test = subjects
      .filter((v) => v.type != 'text')
      .every((v) => {
        v.type == 'true_or_false' || v.type == 'single_selection';
      });

    return test;
  }
}
