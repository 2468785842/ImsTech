import { Axios } from 'axios';
import { newAxiosInstance } from './axiosInstance.js';

// true_or_false 判断题
// single_selection 单选题
// text 概要,一般用来分割不同类型题目, 或是题目选项描述
//   example:
//   一、单项选择题
//    ....
//   二、判断题
//    ....
export type SubjectType = 'true_or_false' | 'text' | 'single_selection';
export type SubjectId = number;
export type OptionId = number;

export default class {
  #activityId: number;
  #axios: Axios;

  get activityId() {
    return this.#activityId;
  }

  constructor(activityId: number) {
    this.#activityId = activityId;
    this.#axios = newAxiosInstance(`exams/${activityId}`);
  }

  async get() {
    const response = await this.#axios.get('');
    return JSON.parse(response.data);
  }

  /**
   * 获取课程概述
   *
   * @param forAllSubjects 是否获取所有课程?
   *
   * @return
   * ```json
   * {
   *     "subjects": [
   *         {
   *             "has_audio": false,
   *             "id": 60022713245,
   *             "point": "25.0",
   *             "type": "true_or_false"
   *         }
   *         ...
   *     ]
   * }
   * ```
   * */
  async getSubjectsSummary(forAllSubjects: boolean) {
    const response = await this.#axios.get('subjects-summary', {
      params: { forAllSubjects }
    });

    const subjectsSummary: {
      subjects: Array<{
        has_audio: boolean;
        id: SubjectId;
        point: string;
        // sub_subjects: Array<any>;
        type: SubjectType;
      }>;
    } = JSON.parse(response.data);

    return subjectsSummary;
  }

  /**
   * 获取提交记录
   *
   * @return
   * ```json
   * {
   *  "exam_final_score": null,
   *  "exam_score": 100.0,
   *  "exam_score_rule": "highest",
   *  "submissions": [
   *      {
   *          "created_at": "2024-10-17T12:12:18Z",
   *          "exam_id": 60000512656,
   *          "exam_type_text": "测试试题",
   *          "id": 60092024720,
   *          "score": "100.0",
   *          "submitted_at": "2024-10-17T12:13:29Z"
   *      }
   *      ...
   *  ]
   * }
   * ```
   */
  async getSubmissions() {
    const response = await this.#axios.get('submissions');

    const submissions: {
      exam_final_score: null | number;
      exam_score: number;
      exam_score_rule: string;
      submissions: Array<{
        created_at: string;
        exam_id: number;
        exam_type_text: string;
        id: SubjectId;
        score: string;
        submitted_at: string;
      }>;
    } = JSON.parse(response.data);

    return submissions;
  }

  /**
   * 获取题目描述
   *
   * @return
   * ```json
   * {
   *  "exam_paper_instance_id": 60091054740,
   *  "subjects": [
   *    {
   *      "description": "<p>一、单项选择题<\p>",
   *      "id": 60022713235,
   *      "options": [],
   *      "point": "0.0",
   *      "type": "text"
   *    },
   *    {
   *      ...,
   *      "options": [
   *        {
   *          "content": "<p>社会主义核心价值观<p>"
   *          "id": 60060738293,
   *          "type": "text"
   *        },
   *        ...
   *      ],
   *      "point": "25.0",
   *      "type": "single_selection"
   *      ]
   *    },
   *    ...
   *  ]
   * }
   * ```
   */
  async getDistribute() {
    const response = await this.#axios.get('distribute');

    const distribute: {
      exam_paper_instance_id: number;
      subjects: Array<{
        // 题目组
        description: string; // 题目
        id: SubjectId;
        options: Array<{
          // 可选答案
          content: string; // 答案描述
          id: OptionId; // 答案id
          type: string; // 类型
        }>;
        point: string; // 分数
        type: SubjectType;
      }>;
    } = JSON.parse(response.data);

    return distribute;
  }

  /**
   * 提交存储, 当开始答题需要调用, 消耗一次答题机会
   * 只是相当标记你已经开始答题
   *
   * @param totalSubjects 题目数量包括标题
   * @see getDistribute
   *
   * @return 当你提交答案时需要带上 id
   */
  async submissionsStorge(
    examPaperInstanceId: number,
    subjectsId: Array<SubjectId>,
    totalSubjects: number
  ): Promise<number> {
    // 随机化分钟数, 绕过某些检测, 伪造某些提交让他们更加随机化
    const randomMinutes = ((Math.random() << 6) % new Date().getMinutes()) - 2;
    const randomTime = new Date(new Date().setMinutes(randomMinutes));

    const response = await this.#axios.post('submissions/storge', {
      exam_paper_instance_id: examPaperInstanceId,
      exam_submission_id: null,
      subjects: subjectsId.map((subjectId) => ({
        subject_id: subjectId,
        subject_updated_at: randomTime.toISOString(),
        answer_option_ids: []
      })),
      progress: {
        answered_num: 0,
        total_subjects: totalSubjects
      }
    });

    return JSON.parse(response.data)['id'];
  }

  /**
   * 提交答案
   * @param examPaperInstanceId 同 submissionStorge
   * @param examSubmissionId submissionStorge返回值
   * @param subjects 答案数组
   * @param totalSubjects 同 submissionStoge
   */
  async submissions(
    examPaperInstanceId: number,
    examSubmissionId: number,
    subjects: Array<{
      subjectId: SubjectId;
      answerOptionIds: OptionId[];
    }>,
    totalSubjects: number
  ) {
    const response = await this.#axios.post('submissions', {
      exam_paper_instance_id: examPaperInstanceId,
      exam_submission_id: examSubmissionId,
      subjects: subjects.map((subject) => ({
        subject_id: subject.subjectId,
        answer_option_ids: subject.answerOptionIds,
        subject_updated_at: new Date().toISOString()
      })),
      progress: {
        answered_num: subjects.length,
        total_subjects: totalSubjects
      },
      reason: 'user'
    });

    return JSON.parse(response.data);
  }
}
