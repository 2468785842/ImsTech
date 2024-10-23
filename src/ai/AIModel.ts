import OpenAI from 'openai';
import 'dotenv/config';
import { exit } from 'process';
import chalk from 'chalk';

import { expect } from '@playwright/test';

import { input } from '../utils.js';

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

  async getResponse(prompt: string) {
    expect(this.#openai, '意外错误 OpenAI 客户端为 null').not.toBeNull();
    const content: OpenAI.Chat.ChatCompletion =
      await this.#openai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              '你将回答选择题，且只返回正确答案的序号(1, 2, 3, 4)。请确保根据国家开放大学的形势与政策课程为依据，并严格选择一个正确答案的序号作为输出。'
          },
          {
            role: 'user',
            content: '请回答以下选择题，并只返回正确答案的序号：'
          },
          { role: 'user', content: prompt },
          { role: 'user', content: '请只返回正确答案的序号。' }
        ],
        model: this.#model
      });
    console.log('AI Answer: ');
    content.choices.forEach((choices) => console.log(choices.message.content));
  }

  #model: string;
  #openai: OpenAI;

  static instance?: AIModel;
}

export default AIModel;
