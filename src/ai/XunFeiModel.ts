import OpenAI from 'openai';
import 'dotenv/config';
import assert from 'assert';
import { exit } from 'process';

import { input } from '../utils.js';

class XunFeiModelClient {
  static async create(): Promise<XunFeiModelClient | null> {
    if (XunFeiModelClient.instance)
      return XunFeiModelClient.instance;

    const api = process.env._API;
    const key = process.env._KEY;
    const model = process.env._MODEL;

    console.log('检查AI设置:');

    if (!api) console.log('未设置 API');
    if (!key) console.log('未设置 Key');
    if (!model) console.log('未设置 Model');

    if (!(api && key && model)) {
      console.log('不自动答题(AI未加载)');
      return null;
    }

    console.log('OK');
    console.log('你真的确定需要"AI"答题吗? ');

    if ((await input('这可能有风险需要自己承担( "y" 确定): ')) != 'y') {
      console.log('程序退出');
      exit();
    }

    XunFeiModelClient.instance = new XunFeiModelClient(api, key, model);
    return XunFeiModelClient.instance;
  }

  private constructor(api: string, key: string, model: string) {
    this.#model = model;
    this.#openai = new OpenAI({
      baseURL: api,
      apiKey: key
    })!!;
  }

  async getResponse(prompt: string) {
    assert(this.#openai, '意外错误 OpenAI 客户端为 null');
    const content: OpenAI.Chat.ChatCompletion =
      await this.#openai!!.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.#model
      });
    for (const choice of content.choices) {
      console.log('AI: ', choice.message.content);
    }
  }

  #model: string;
  #openai: OpenAI;

  private static instance?: XunFeiModelClient;
}

export default XunFeiModelClient;
