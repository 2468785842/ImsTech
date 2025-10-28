import { AxiosError, HttpStatusCode } from 'axios';
import chalk from 'chalk';
import { Page } from 'playwright';
import { exit } from 'process';
import { sleep } from 'openai/core.js';

import { Processor } from '../processor.js';

import AIModel, { Num, num2Letter } from '../../ai/AIModel.js';
import course from '../../api/course.js';
import Exam, { OptionId, SubjectId } from '../../api/Exam.js';
import { parseDOMText } from '../../utils.js';
import BaseSubjectResolver from '../exam/BaseSubjectResolver.js';
import { createResolver, hasResolver, s2s } from '../exam/resolver.js';
import { CourseInfo, CourseType } from '../search.js';
import Config from '../../config.js';

/**
 * score当你全部答对就是100, point是得分百分比, 比如总分112, 实际你exam_score最大为: 100
 */
export default class ExamProc implements Processor {
  name: CourseType = 'exam';

  #courseInfo?: CourseInfo;
  #totalPoints: number = Config.totalPoints;
  #totalScore: number = -1;

  // config
  private tryCount = 15;

  async condition(info: CourseInfo) {
    this.#courseInfo = info;
    console.log('id:', info.activityId);
    const exam = new Exam(info.activityId);

    if (!AIModel.instance) {
      console.log('AI 未加载: skip');
      return false;
    }

    if (!(await this.isSupport(exam))) {
      console.log('考试问题某些类型目前不支持: skip');
      return false;
    }

    return true;
  }

  async exec(page: Page) {
    console.assert(this.#courseInfo, 'error course info is null');
    console.assert(AIModel.instance, 'error ai model is null');

    const exam = new Exam(this.#courseInfo!.activityId);
    const subjectResolverList: Partial<Record<SubjectId, BaseSubjectResolver>> =
      {};

    // 过滤出所有问题
    let q = await this.pullQuestions(
      exam,
      page,
      AIModel.instance!,
      subjectResolverList,
    );

    if (q) {
      // need 'BENSESSCC_TAG' Cookie
      const response = await course.activitiesRead(
        this.name,
        this.#courseInfo!.activityId,
      );
      const cookies = response.headers['set-cookie'];

      if (!cookies) {
        console.error(chalk.red('获取Cookie失败: 未知错误'));
        exit();
      }

      exam.addCookies(
        cookies.flatMap((cookie) => {
          const raw = cookie.split(';');
          const [k, v] = raw[0].split('=');
          return { name: k, value: v };
        }),
      );
    }

    for (let i = 0; q && i < this.tryCount; i++) {
      const { questions, examPaperInstanceId, subjects, total } = q;

      const submissionId = await exam.submissionsStorage({
        exam_paper_instance_id: examPaperInstanceId,
        subjects,
      });

      if (!submissionId) {
        console.log('意料之外的错误:', "can't get submissionId");
        exit();
      }

      const answerSubjects = await Promise.all(
        questions.map(async (subject) => {
          const resolver = subjectResolverList[subject.id];

          if (!resolver) {
            console.error(subject);
            throw new Error(
              `Oops! impossable!! can't found resolver: ${subject.id} ${subject.type}`,
            );
          }

          const answerOptionIds = await resolver.getAnswer();

          if (!resolver.isPass()) {
            // 打印题目
            console.log(
              chalk.bgGreenBright(
                `${' '.repeat(10)}${s2s[subject.type]} ${' '.repeat(10)}`,
              ),
            );

            console.log(subject.description);
            const entries = subject.options.entries();

            for (const [i, v] of entries) {
              console.log(`\t${num2Letter(i as Num)}. ${v.content}`);
            }

            console.log(
              'AI 回答:',
              subject.options.flatMap(({ id }, i) =>
                answerOptionIds.includes(id) ? num2Letter(i as Num) : [],
              ),
              answerOptionIds,
            );

            console.log();
          }

          return {
            subjectId: subject.id,
            answerOptionIds,
            updatedAt: subject.last_updated_at,
          };
        }),
      );

      const waitTime = total * 200 + Math.random() * 5 * 100;
      console.log((waitTime / 1000).toFixed(2), '秒后提交');

      await page.waitForTimeout(waitTime);

      await this.submitAnswer(
        exam,
        examPaperInstanceId,
        submissionId,
        answerSubjects,
        total,
      );

      q = await this.pullQuestions(
        exam,
        page,
        AIModel.instance!,
        subjectResolverList,
      );

      if (q) {
        console.log('不是满分, 重新执行');
        console.log('尝试次数:', i + 1);

        const waitTime = total * 1000;
        console.log(waitTime / 1000, '秒后重新开始答题');
        await page.waitForTimeout(waitTime);
      }
    }

    // 可复用的, 需要清除
    this.#courseInfo = undefined;
    this.#totalScore = -1;
  }

  // 提交答案
  private async submitAnswer(
    exam: Exam,
    examPaperInstanceId: number,
    submissionId: number,
    subjects: Array<{
      subjectId: SubjectId;
      answerOptionIds: OptionId[];
      updatedAt: string;
    }>,
    totalSubjects: number,
  ) {
    let r;
    let counter = 5;
    do {
      try {
        r = await exam.postSubmissions(
          examPaperInstanceId,
          submissionId,
          subjects,
          totalSubjects,
        );
      } catch (e) {
        // 这里有时候返回429并不是真的太多请求
        // 也有可能是请求头缺少某些字段,导致验证失败
        if (
          e instanceof AxiosError &&
          e.response!.status === HttpStatusCode.TooManyRequests
        ) {
          console.log('太多请求, 等待10s');
          await sleep(10000);
          counter--;
          continue;
        }
        throw e; // Re-throw if it's not a 429 error
      }
    } while (!r && counter > 0);
  }

  private async createSubjectResolverList(
    subjects: Awaited<
      ReturnType<typeof Exam.prototype.getDistribute>
    >['subjects'],
    aiModel: AIModel,
  ) {
    return subjects
      .filter((subject) => subject.type != 'text')
      .reduce(
        (acc, subject) => {
          acc[subject.id] = createResolver(subject.type, subject, aiModel);
          return acc;
        },
        {} as Record<SubjectId, BaseSubjectResolver>,
      );
  }

  /**
   * 提取考试历史成绩
   * @param param0
   * @returns [最新考试成绩, 历史最高分]
   */
  private async getHistoryScore({
    exam_score: examScore,
    submissions,
  }: Awaited<ReturnType<typeof Exam.prototype.getSubmissions>>): Promise<
    [number | undefined, number | undefined]
  > {
    if (examScore != void 0) {
      // 获取最新的结果
      let newestIndex = 0;
      for (let i = 1; submissions && i < submissions.length; i++) {
        if (
          new Date(submissions[newestIndex].submitted_at) <
          new Date(submissions[i].submitted_at)
        ) {
          newestIndex = i;
        }
      }

      let curScore: number | undefined = Number(
        submissions?.[newestIndex]?.score,
      );
      curScore = Number.isNaN(curScore) ? void 0 : curScore;

      console.log(
        '分数(最新/最高/总分)[%]/总分:',
        `(${curScore ?? '?'}/${examScore}/${this.#totalPoints})[%]/${this.#totalScore}`,
      );

      return [curScore, examScore];
    }

    return [void 0, void 0];
  }

  private async pullQuestions(
    exam: Exam,
    page: Page,
    aiModel: AIModel,
    subjectResolverList: Partial<Record<SubjectId, BaseSubjectResolver>>,
  ) {
    let getSubmission = await exam.getSubmissions();

    let i = 0;
    while (
      i < 5 &&
      getSubmission.submissions?.find(({ score }) => score == null)
    ) {
      console.log('等待系统评分...');
      await sleep(10000);
      getSubmission = await exam.getSubmissions();
      i++;
    }

    const [_, examScore] = await this.getHistoryScore(getSubmission);

    if (
      examScore &&
      (examScore == this.#totalPoints || examScore > this.#totalPoints)
    )
      return null;

    // 确实还不知道, 要不要重新获取问题, 有可能不重新获取亦可以? 可以复用?
    const getDistribute = await exam.getDistribute();

    const subjects = await Promise.all(
      getDistribute.subjects.map(async (subject) => {
        const options: (typeof subject)['options'] = [];

        for (const opt of subject.options) {
          options.push({
            ...opt,
            content: await parseDOMText(page, opt.content),
          });
        }

        return {
          ...subject,
          description: await parseDOMText(page, subject.description),
          options,
        };
      }),
    );

    const srl = await this.createSubjectResolverList(subjects, aiModel);

    for (const id in srl) {
      if (!subjectResolverList[id]) {
        subjectResolverList[id] = srl[id];
      }
    }

    // 答过题, 获取已知答案
    if (examScore) {
      console.log('正在收集历史考试答案...');
      // TODO: 实际上不用每次都去重新获取一遍
      for (const { id } of getSubmission.submissions!) {
        await this.collectSubmissons(id, exam, subjectResolverList);
      }
    }

    return {
      questions: subjects.filter(({ type }) => type != 'text'),
      examPaperInstanceId: getDistribute.exam_paper_instance_id,
      subjects,
      total: subjects.length,
    };
  }

  private async collectSubmissons(
    id: number,
    exam: Exam,
    subjectResolverList: Partial<Record<SubjectId, BaseSubjectResolver>>,
  ) {
    const {
      subjects_data: { subjects },
      submission_data,
      submission_score_data,
    } = await exam.getSubmission(id);

    // 收集正确 或错误答案
    // 需要注意的是, 如果是多选题, 我们无法知道哪些选项是错误的, 哪些是正确的
    for (const { subject_id, answer_option_ids } of submission_data.subjects) {
      const { options } = subjects.find(({ id }) => id == subject_id)!;
      const score = Number(submission_score_data[subject_id]); //百分比

      let filterOpts = answer_option_ids;

      if (score != 0) {
        filterOpts = options.flatMap(({ id }) =>
          answer_option_ids.includes(id) ? [] : id,
        );
      }

      await subjectResolverList[subject_id]!.addAnswerFilter(
        score,
        ...filterOpts,
      );
    }
  }

  private async isSupport(exam: Exam): Promise<boolean> {
    const examInfo = await exam.get();

    const {
      submit_times,
      submitted_times,
      total_points,
      announce_score_status,
    } = examInfo;

    this.#totalScore = total_points;

    console.log('完成标准:', examInfo['completion_criterion']);
    console.log('标题:', examInfo['title']);
    console.log('成绩比例:', examInfo['score_percentage']);
    console.log('题目数:', examInfo['subjects_count']);
    console.log('允许提交次数:', submit_times);
    console.log('已经提交次数:', submitted_times);
    console.log('公布成绩:', announce_score_status);
    console.log('总分:', total_points);

    // immediate_announce no_announce
    if (announce_score_status != 'immediate_announce') return false;

    if (submit_times != 999 || submit_times <= submitted_times) return false; // 可提交次数必须足够大, 因为AI答不准

    console.log('检查考试信息...');
    // check subject summary
    const { subjects } = await exam.getSubjectsSummary(true);

    console.log(
      subjects.flatMap((s) =>
        s.type != 'text' ? (s2s[s.type] ?? s.type) : [],
      ),
    );

    const isSupportSubject = ({ type }: (typeof subjects)[number]) =>
      hasResolver(type);

    const test = subjects
      .filter((v) => v.type != 'text')
      .every((v) =>
        v.type == 'random'
          ? v.sub_subjects.every(isSupportSubject)
          : isSupportSubject(v),
      );

    return test;
  }
}
