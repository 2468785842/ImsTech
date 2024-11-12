import OpenAI from 'openai';
import 'dotenv/config';
import { exit } from 'process';
import chalk from 'chalk';
import https from 'https';

import { input } from '../utils.js';
import { SubjectType } from '../api/Exam.js';
import Config from '../config.js';
import { sleep } from 'openai/core.js';
import { format } from 'util';

class AIModel {
  static async init(agree: boolean = false): Promise<AIModel | null> {
    if (AIModel.instance) return AIModel.instance;

    const { api, key, model, qps } = Config.ai;

    if (!(api && key && model)) {
      console.log('不自动答题(AI未加载)');
      return null;
    }

    if (!agree) {
      console.log('你真的确定需要"AI"答题吗? ');

      if ((await input('这可能有风险需要自己承担( "y" 确定): ')) != 'y') {
        console.log('程序退出');
        exit();
      }
    }

    AIModel.instance = new AIModel(api, key, model, qps);
    return AIModel.instance;
  }

  private constructor(api: string, key: string, model: string, Qps: number) {
    const proxy = Config.proxy;
    this.#model = model;
    this.#openai = new OpenAI({
      baseURL: api,
      apiKey: key,
      httpAgent:
        Config.proxy &&
        new https.Agent({
          host: proxy!.host,
          port: proxy!.port,
          rejectUnauthorized: false, // 忽略 SSL 证书验证
        }),
    })!;
    this.#Qps = Qps;
  }

  /**
   * 询问题目, 获取AI的回答
   *
   * @param type 题目类型
   * @param description 题目描述
   * @param options 可选项
   * @returns 返回可选项索引
   */
  async getResponse(
    type: SubjectType,
    description: string,
    options: string[],
  ): Promise<number> {
    if (options.length < 2) {
      console.error(chalk.red('意料之外的错误, 问题选项数量 < 2 ???'));
      exit();
    }

    while (this.#taskQueue.length != 0) {
      await this.#taskQueue[this.#taskQueue.length - 1];
      await sleep(1000 / this.#Qps + 300);
    }

    console.assert(this.#openai, '意外错误 OpenAI 客户端为 null');

    let content: OpenAI.Chat.ChatCompletion | null | undefined;

    const strategies: Partial<
      Record<
        SubjectType,
        (description: string, options: string[]) => Promise<typeof content>
      >
    > = {
      single_selection: this.singleSelection,
      true_or_false: this.trueOrFalse,
    };

    if (!strategies[type]) {
      console.log('不支持的问题类型:', type);
      exit();
    }

    const task = strategies[type]!.bind(this)(description, options);

    this.#taskQueue.push(task);

    content = await task;

    this.#taskQueue.pop();

    // 检查返回的 choices 是否为空
    if (!content || content.choices.length === 0) {
      console.error(chalk.red('AI 意料之外的错误：没有返回任何答案'));
      exit();
    }

    // 提取并解析 AI 返回的答案
    const responses = (
      content.choices[0].message.content?.trim() ?? ''
    ).replace(/答案：|答案:|答案/, '');

    let answerId = responses
      .match(/[a-zA-Z]/)?.[0]
      ?.trim()?.[0]
      ?.toUpperCase();

    if (!answerId || answerId > 'D') {
      throw '解析 AI 回答出错, 无法正确处理: ' + answerId;
    }

    // 确保只匹配 1-4 的数字
    const num = letter2Num(answerId as Letter);

    if (!Number.isInteger(num)) {
      console.error(chalk.red('无法解析 AI 回答:'), responses, 'parse:', num);
      exit();
    }

    if (num >= options.length) {
      console.error(chalk.red('AI 回答序号超出答案序号:'), responses);
      exit();
    }

    return num; // 确保只返回匹配到的数字
  }

  async trueOrFalse(description: string, options: string[]) {
    const [questionContent, systemConstraint] = this.constraintTemplate(
      '判断题',
      description,
      options,
    );

    const content: OpenAI.Chat.ChatCompletion =
      await this.#openai!.chat.completions.create({
        messages: [
          { role: 'system', content: systemConstraint },
          { role: 'user', content: questionContent },
          { role: 'user', content: '请只返回正确答案的字母' },
        ],
        model: this.#model,
      });

    return content;
  }

  async singleSelection(description: string, options: string[]) {
    const [questionContent, systemConstraint] = this.constraintTemplate(
      '选择题',
      description,
      options,
    );

    const content: OpenAI.Chat.ChatCompletion =
      await this.#openai!.chat.completions.create({
        messages: [
          { role: 'system', content: systemConstraint },
          { role: 'user', content: questionContent },
          { role: 'user', content: '请只返回正确答案的字母' },
        ],
        model: this.#model,
      });

    return content;
  }

  private constraintTemplate(
    type: string,
    description: string,
    options: string[],
  ) {
    return [
      this.questionContentTemplate(type, description, options),
      this.systemConstraintTemplate(type, options),
    ];
  }

  private questionContentTemplate(
    type: string,
    description: string,
    options: string[],
  ) {
    console.assert(options.length < 5, '可选项太多 > 4');
    const questionContent = format(
      '%s\n%s\n%s\n%s',
      `请回答以下${type}，并只返回正确答案的字母：`,
      `题目：${description}`,
      '选项：',
      `${options.map((option, index) => `\t${num2Letter(index as Num)}. ${option}`).join('\n')}`,
    );
    return questionContent;
  }

  private systemConstraintTemplate(type: string, options: string[]) {
    console.assert(options.length < 5, '可选项太多 > 4');
    const systemConstraint = `你将回答${type}。只返回正确答案的字母(${options
      .map((_, i) => num2Letter(i as Num))
      .join(',')})。`;
    return systemConstraint;
  }

  #model: string;
  #openai: OpenAI;
  #Qps: number;
  #taskQueue: Array<Promise<any>> = [];

  static instance?: AIModel;
}

export type Num = 0 | 1 | 2 | 3;

export type Letter = 'A' | 'B' | 'C' | 'D';

export function num2Letter(n: Num): Letter {
  return String.fromCharCode(n + 'A'.charCodeAt(0)) as Letter;
}

export function letter2Num(c: Letter): Num {
  return (c.charCodeAt(0) - 'A'.charCodeAt(0)) as Num;
}

export default AIModel;
