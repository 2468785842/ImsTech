import { Page } from 'playwright';

import { Processor } from '../processor.js';

import { CourseInfo, CourseType } from '../search.js';
import Exam, { OptionId, SubjectId } from '../../api/Exam.js';
import AIModel from '../../ai/AIModel.js';
import { exit } from 'process';

export default class ExamProc implements Processor {
  name: CourseType = 'exam';

  #courseInfo?: CourseInfo;
  #totalPoints: number = 0;
  #exam?: Exam;

  async condition(info: CourseInfo) {
    this.#courseInfo = info;
    console.log(info.activityId);
    this.#exam = new Exam(info.activityId);
    return (await this.isSupport(this.#exam!)) && !!AIModel.instance;
  }

  async exec(page: Page) {
    console.assert(this.#courseInfo, 'error course info is null');
    console.assert(AIModel.instance, 'error ai model is null');
    console.assert(this.#exam, '意料之外的错误, 实例化类失败?');

    const exam = this.#exam!;

    // 问题正确解集合, 奖池会累加!! :)
    let rightQuestionOptions: Record<SubjectId, OptionId[]> = {};

    const pullQuestions = async () => {
      const { exam_score, submissions } = await exam.getSubmissions();

      console.assert(
        exam_score != void 0,
        '分数:',
        exam_score,
        '/',
        this.#totalPoints
      );

      if (exam_score == this.#totalPoints) {
        return null;
      }

      // 确实还不知道, 要不要重新获取问题, 有可能不重新获取亦可以? 可以复用?
      const { exam_paper_instance_id: examPaperInstanceId, subjects } =
        await exam.getDistribute();

      let questions = subjects.filter((subject) => subject.type != 'text');

      // TODO: 我们需要总结所有的考试结果, 因为有些考试是随机题目
      // 目前是获取最高分数
      const maxSubmission = submissions?.find(
        (v) => v.score == String(exam_score)
      );

      // 答过题, 获取已知答案
      if (maxSubmission) {
        const { submission_data, submission_score_data } =
          await exam.getSubmission(maxSubmission.id);

        // 收集正确答案
        submission_data.subjects.forEach(
          ({ subject_id, answer_option_ids }) => {
            if (Number(submission_score_data[subject_id]) != 0) {
              rightQuestionOptions[subject_id] = answer_option_ids;
            }
          }
        );

        // 需要过滤错误答案
        questions = questions.map((question) => ({
          ...question,
          options: question.options.filter(
            (option) =>
              !(
                option.id in submission_score_data &&
                Number(submission_score_data[option.id]) == 0
              )
          )
        }));
      }

      return {
        questions,
        examPaperInstanceId,
        total: subjects.length
      };
    };

    // 过滤出所有问题
    let q = await pullQuestions();

    for (let i = 0; q && i < 5; i++) {
      // 随机等待, 一次性不能请求太多
      await page.waitForTimeout(q.total * 500 + Math.random() * 5);

      const { questions, examPaperInstanceId, total } = q;
      // console.log('questions:', questions);

      const submissionId = await exam.submissionsStorage();

      const optionIds = await Promise.all(
        questions.map(async (question) => {
          if (question.id in rightQuestionOptions) {
            return {
              subjectId: question.id,
              answerOptionIds: rightQuestionOptions[question.id]
            };
          }

          // 找不到的问AI
          const resp = await AIModel.instance!.getResponse(
            question.type,
            question.description,
            question.options.map(
              (option, index) => `${index} ${option.content}`
            )
          );

          return {
            subjectId: question.id,
            answerOptionIds: resp.map((i) => question.options[i].id)
          };
        })
      );

      const r = await exam.postSubmissions(
        examPaperInstanceId,
        submissionId,
        optionIds,
        total
      );

      console.log('exam submissions result:', r);

      console.log('不是满分, 重新执行');

      q = await pullQuestions();
      console.log('尝试次数:', i + 1);
    }

    // Debug
    if (this.#courseInfo!.progress != 'full') exit();

    // 可复用的, 需要清除
    this.#courseInfo = undefined;
    this.#totalPoints = 0;
    this.#exam = undefined;
  }

  private async isSupport(exam: Exam): Promise<boolean> {
    const examInfo = await exam.get();

    const { submit_times, total_points } = examInfo;

    this.#totalPoints = total_points;

    console.log('完成标准:', examInfo['completion_criterion']);
    console.log('标题:', examInfo['title']);
    console.log('成绩比例:', examInfo['score_percentage']);
    console.log('题目数:', examInfo['subjects_count']);
    console.log('允许提交次数:', examInfo['submit_times']);
    console.log('已经提交次数:', examInfo['submitted_times']);
    console.log('总分:', total_points);

    if (submit_times != 999) return false; // 可提交次数必须足够大, 因为AI答不准
    // if (subjects_count > 4) return false; // 题目要少 不然 AI 不行的

    // check subject summary
    const subjectsSummary = await exam.getSubjectsSummary(true);
    const { subjects } = subjectsSummary;

    const test = subjects
      .filter((v) => v.type != 'text')
      .every((v) =>
        ['true_or_false', 'single_selection', 'multiple_selection'].includes(
          v.type
        )
      );

    return test;
  }
}
