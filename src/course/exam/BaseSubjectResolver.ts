import AIModel from '../../ai/AIModel.js';
import { OptionId, SubjectId, SubjectType } from '../../api/Exam.js';

export type Option = {
  // 可选答案
  content: string; // 答案描述
  id: OptionId; // 答案id
  type: string; // 类型
};

export type Subject = {
  // 题目组
  description: string; // 题目
  id: SubjectId;
  last_updated_at: string; // ISO time
  options: Option[];
  point: string; // 得分百分比
  type: SubjectType;
};

abstract class BaseSubjectResolver {
  private _subject: Subject;
  private _aiModel: AIModel;

  get subject() {
    return this._subject;
  }

  get aiModel() {
    return this._aiModel;
  }

  constructor(subject: Subject, aiModel: AIModel) {
    this._subject = subject;
    this._aiModel = aiModel;
  }

  /**
   * 添加一个选项数组, 由实现者判断次选项是否正确
   *
   * @param score 得分百分比
   * @param optionIds 此次错误选项集合
   */
  abstract addAnswerFilter(
    score: number,
    ...optionIds: OptionId[]
  ): Promise<void>;

  abstract getAnswer(): Promise<OptionId[]>;
  abstract isPass(): boolean;
}

export default BaseSubjectResolver;
