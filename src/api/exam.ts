import axiosInstance from './axiosInstance.js';
import Api from './axiosInstance.js';

export default class {
  activityId: number;

  constructor(activityId: number) {
    this.activityId = activityId;
  }

  getBaseUrl() {
    return `exams/${this.activityId}`;
  }

  async get() {
    const response = await Api.get(this.getBaseUrl());
    console.log('status', response.status);
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
   *             "sub_subjects": [],
   *             "type": "true_or_false"
   *         }
   *         ...
   *     ]
   * }
   * ```
   * */
  async getSubjectsSummary(forAllSubjects: boolean) {
    // true_or_false 判断题

    // single_selection 单选题

    // text 概要,一般用来分割不同类型题目
    //   example:
    //   一、单项选择题
    //    ....
    //   二、判断题
    //    ....

    type subjectType = 'true_or_false' | 'text' | 'single_selection';

    const response = await axiosInstance.get(
      `${this.getBaseUrl()}/subject-summary`,
      { params: { forAllSubjects } }
    );

    console.log('status', response.status);

    const subjects: Array<{
      has_audio: boolean;
      id: number;
      point: string;
      sub_subjects: Array<any>;
      type: subjectType;
    }> = JSON.parse(response.data)['subjects'];

    return subjects;
  }
}
