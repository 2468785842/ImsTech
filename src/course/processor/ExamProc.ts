import { Page } from 'playwright';

import { Processor } from '../processor.js';

import { CourseInfo, CourseType } from '../search.js';
import Exam, { OptionId, SubjectId } from '../../api/Exam.js';
import AIModel from '../../ai/AIModel.js';
import { exit } from 'process';
import course from '../../api/course.js';
import chalk from 'chalk';
import { parseDOMText } from '../../utils.js';
import { AxiosError, HttpStatusCode } from 'axios';

export default class ExamProc implements Processor {
  name: CourseType = 'exam';

  #courseInfo?: CourseInfo;
  #totalPoints: number = 0;

  async condition(info: CourseInfo) {
    this.#courseInfo = info;
    console.log(info.activityId);
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

    // 问题错误解集合
    const wrongQuestionOptions: Record<SubjectId, OptionId[] | undefined> = {};

    // 问题正确解集合, 奖池会累加!! :)
    const rightQuestionOptions: Record<SubjectId, OptionId[] | undefined> = {};

    // 过滤出所有问题
    let q = await this.pullQuestions(
      exam,
      page,
      rightQuestionOptions,
      wrongQuestionOptions,
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

    for (let i = 0; q && i < 5; i++) {
      const { questions, examPaperInstanceId, subjects, total } = q;
      // console.log('questions:', questions);

      const submissionId = await exam.submissionsStorage({
        exam_paper_instance_id: examPaperInstanceId,
        subjects,
      });

      const optionIds = await Promise.all(
        questions.map(async (question) => {
          // 正确解集合中已有答案
          if (rightQuestionOptions[question.id]) {
            console.log('已经知道答案:', question.id);

            return {
              subjectId: question.id,
              answerOptionIds: rightQuestionOptions[question.id]!,
              updatedAt: question.last_updated_at,
            };
          }

          // 只有一个选项, 我们可以肯定它是对的
          if (question.options.length == 1) {
            console.log('可以推断出答案:', question.id);

            return {
              subjectId: question.id,
              answerOptionIds: [question.options[0].id],
              updatedAt: question.last_updated_at,
            };
          }

          // 找不到的问AI
          const resp = await AIModel.instance!.getResponse(
            question.type,
            await parseDOMText(page, question.description),
            await Promise.all(
              question.options.map(
                async ({ content }) => await parseDOMText(page, content),
              ),
            ),
          );

          return {
            subjectId: question.id,
            answerOptionIds: resp.map((i) => question.options[i].id),
            updatedAt: question.last_updated_at,
          };
        }),
      );

      const waitTime = total * 400 + Math.random() * 5 * 100;
      console.log((waitTime / 1000).toFixed(2), '秒后提交');

      await page.waitForTimeout(waitTime);

      if (!submissionId) {
        console.log('意料之外的错误:', "can't get submissionId");
        exit();
      }

      // 提交答案
      let r;
      let counter = 3;
      do {
        try {
          r = await exam.postSubmissions(
            examPaperInstanceId,
            submissionId,
            optionIds,
            total,
          );
        } catch (e) {
          // 这里有时候返回429并不是真的太多请求
          // 也有可能是请求头缺少某些字段,导致验证失败
          if (
            e instanceof AxiosError &&
            e.response?.status === HttpStatusCode.TooManyRequests
          ) {
            console.log('太多请求, 等待10s');
            await page.waitForTimeout(10000);
            counter--;
            continue;
          }
          throw e; // Re-throw if it's not a 429 error
        }
      } while (!r && counter > 0);

      q = await this.pullQuestions(
        exam,
        page,
        rightQuestionOptions,
        wrongQuestionOptions,
      );

      if (q) {
        console.log('不是满分, 重新执行');
        console.log('尝试次数:', i + 1);

        const waitTime = total * 2000;
        console.log(waitTime / 1000, '秒后重新开始答题');
        await page.waitForTimeout(waitTime);
      }
    }

    // 可复用的, 需要清除
    this.#courseInfo = undefined;
    this.#totalPoints = 0;
  }

  private async pullQuestions(
    exam: Exam,
    page: Page,
    rightQuestionOptions: Record<SubjectId, OptionId[] | undefined>,
    wrongQuestionOptions: Record<SubjectId, OptionId[] | undefined>,
  ) {
    let { exam_score, submissions } = await exam.getSubmissions();

    while (submissions && !submissions.every(({ score }) => score != null)) {
      console.log('等待系统评分');
      await page.waitForTimeout(10000);

      const t = await exam.getSubmissions();
      exam_score = t.exam_score;
      submissions = t.submissions;
    }

    if (exam_score != void 0) {
      // 获取最新的结果
      let newestIndex = 0;
      for (let i = 1; submissions && i < submissions.length; i++) {
        if (
          new Date(submissions[newestIndex].submitted_at).getTime() <
          new Date(submissions[i].submitted_at).getTime()
        ) {
          newestIndex = i;
        }
      }

      const curScore = submissions?.[newestIndex]?.score ?? '?';

      console.log(
        '分数(最新/最高/总分):',
        `${curScore}/${exam_score}/${this.#totalPoints}`,
      );
    }

    if (exam_score == this.#totalPoints) {
      return null;
    }

    // 确实还不知道, 要不要重新获取问题, 有可能不重新获取亦可以? 可以复用?
    const { exam_paper_instance_id: examPaperInstanceId, subjects } =
      await exam.getDistribute();

    let questions = subjects.filter((subject) => subject.type != 'text');

    // 目前是获取最高分数
    const maxSubmission = submissions?.find(
      (v) => v.score && Number(v.score) == exam_score,
    );

    // 答过题, 获取已知答案
    if (maxSubmission) {
      const { submission_data, submission_score_data } =
        await exam.getSubmission(maxSubmission.id);

      // 收集正确 或错误答案
      // TODO: 目前不支持多选题
      submission_data.subjects.forEach(({ subject_id, answer_option_ids }) => {
        const oos =
          Number(submission_score_data[subject_id]) != 0
            ? rightQuestionOptions
            : wrongQuestionOptions;

        // merge unique
        oos[subject_id] = [
          ...new Set([...(oos[subject_id] ?? []), ...answer_option_ids]),
        ];
      });

      // 需要过滤错误答案
      questions = questions.map((question) => {
        const score = Number(submission_score_data[question.id]);

        // 我们已经回答正确了, TODO: 如果是多选题需要修改此处逻辑
        // 直接返回就行了, 后面做处理
        if (score != 0) {
          return question;
        }

        const wqo = wrongQuestionOptions;

        // 回答错误的选项需要过滤
        const options = question.options
          .filter((option) => !wqo[question.id]?.find((id) => id == option.id))
          .filter((option) => {
            const { answer_option_ids } = submission_data.subjects.find(
              (pre) => pre.subject_id == question.id,
            )!;

            // 需要添加错误解集合
            return !answer_option_ids.find((v) => v == option.id);
          });

        // 将还不知道的选项除外, 都是错误的
        wqo[question.id] = question.options.flatMap((option) =>
          options.find((opt) => opt.id == option.id) ? [] : option.id,
        );

        // console.log('options:', options);
        // console.log('wqo:', wqo[question.id]);

        return { ...question, options };
      });
    }

    return {
      questions,
      examPaperInstanceId,
      subjects,
      total: subjects.length,
    };
  }

  private async isSupport(exam: Exam): Promise<boolean> {
    const examInfo = await exam.get();

    const { submit_times, submitted_times, total_points } = examInfo;

    this.#totalPoints = total_points;

    console.log('完成标准:', examInfo['completion_criterion']);
    console.log('标题:', examInfo['title']);
    console.log('成绩比例:', examInfo['score_percentage']);
    console.log('题目数:', examInfo['subjects_count']);
    console.log('允许提交次数:', submit_times);
    console.log('已经提交次数:', submitted_times);
    console.log('总分:', total_points);

    if (submit_times != 999 || submit_times <= submitted_times) return false; // 可提交次数必须足够大, 因为AI答不准
    // if (subjects_count > 4) return false; // 题目要少 不然 AI 不行的

    // check subject summary
    const { subjects } = await exam.getSubjectsSummary(true);

    const isSupportSubject = (subject: (typeof subjects)[number]) =>
      ['true_or_false', 'single_selection' /*'multiple_selection'*/].includes(
        subject.type,
      );

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
