import test, { expect } from '@playwright/test';
import AIModel from '../src/ai/AIModel.js';

test('测试AI连通', async () => {
  const aiModel = AIModel.init(true);
  expect(await aiModel, '连接失败').not.toBeNull();
  await AIModel.instance!!.getResponse('你是谁');
  await AIModel.instance!!.getResponse('哈喽!');
});