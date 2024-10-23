import OpenAI from 'openai';
import 'dotenv/config';
import { exit } from 'process';
import chalk from 'chalk';

import { input } from '../utils.js';
import { SubjectType } from '../api/Exam.js';

class AIModel {
  static async init(agree: boolean = false): Promise<AIModel | null> {
    if (AIModel.instance) return AIModel.instance;

    const api = process.env._API;
    const key = process.env._KEY;
    const model = process.env._MODEL;

    console.log('检查AI设置:');

    const checkUnicode = (v: any) => (v ? chalk.green('✓') : chalk.red('✘'));

    console.log('API', checkUnicode(api));
    console.log('Key', checkUnicode(key));
    console.log('Model', checkUnicode(model));

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

    AIModel.instance = new AIModel(api, key, model);
    return AIModel.instance;
  }

  private constructor(api: string, key: string, model: string) {
    this.#model = model;
    this.#openai = new OpenAI({
      baseURL: api,
      apiKey: key
    })!;
  }

  async getResponse(
    type: SubjectType,
    description: string,
    options: string[]
  ): Promise<number> {
    console.assert(this.#openai, '意外错误 OpenAI 客户端为 null');

    let content: OpenAI.Chat.ChatCompletion | null | undefined;

    const strategies: Partial<
      Record<
        SubjectType,
        (description: string, options: string[]) => Promise<typeof content>
      >
    > = {
      single_selection: this.singleSelection,
      true_or_false: this.trueOrFalse
    };

    if (!strategies[type]) {
      console.log('不支持的问题类型:', type);
      exit();
    }

    content = await strategies[type].bind(this)(description, options);

    // 检查返回的 choices 是否为空
    if (!content || content.choices.length === 0) {
      console.error('AI 意料之外的错误：没有返回任何答案');
      exit();
    }

    // 提取并解析 AI 返回的答案
    const response = content.choices[0].message.content?.trim() ?? '';
    const answerMatch = response[0]; // 确保只匹配 1-4 的数字

    if (!answerMatch) {
      console.error('AI 返回的答案格式无效:', response);
      exit();
    }

    if (Number(answerMatch) > options.length) {
      console.error('AI 回答序号超出答案序号:', response);
      exit();
    }

    return Number(answerMatch); // 确保只返回匹配到的数字
  }

  async trueOrFalse(description: string, options: string[]) {
    const questionContent = `
      请回答以下判断题，并只返回正确答案的序号：
        题目：${description}
        选项：
        ${options.map((option, index) => `${index}. ${option}`).join('\n')}
    `;

    const systemConstraint = `
      你将回答判断题。
      只返回正确答案的序号(${options.map((_, i) => i).join(',')})。
      严格选择一个正确答案的数字作为输出。
    `;

    // console.log(questionContent);
    // console.log(systemConstraint);

    const content: OpenAI.Chat.ChatCompletion =
      await this.#openai!.chat.completions.create({
        messages: [
          { role: 'system', content: systemConstraint },
          { role: 'user', content: questionContent },
          { role: 'user', content: '请只返回正确答案的序号' }
        ],
        model: this.#model
      });

    return content;
  }

  async singleSelection(description: string, options: string[]) {
    const questionContent = `
      请回答以下选择题，并只返回正确答案的序号：
        题目：${description}
        选项：
        ${options.map((option, index) => `${index}. ${option}`).join('\n')}
    `;

    const systemConstraint = `
      你将回答选择题。
      只返回正确答案的序号(${options.map((_, i) => i).join(',')})。
      严格选择一个正确答案的数字作为输出。
    `;

    // console.log(questionContent);
    // console.log(systemConstraint);

    const content: OpenAI.Chat.ChatCompletion =
      await this.#openai!.chat.completions.create({
        messages: [
          { role: 'system', content: systemConstraint },
          { role: 'user', content: questionContent },
          { role: 'user', content: '请只返回正确答案的序号' }
        ],
        model: this.#model
      });

    return content;
  }

  #model: string;
  #openai: OpenAI;

  static instance?: AIModel;
}

export default AIModel;
