import test, { expect } from '@playwright/test';
import AIModel from '../src/ai/AIModel.js';

// test('测试AI连通', async () => {
//   const aiModel = AIModel.init(true);
//   expect(await aiModel, '连接失败').not.toBeNull();
//   await AIModel.instance!.getResponse('你是谁');
//   await AIModel.instance!.getResponse('哈喽!');
// });

test('单项选择题测试', async () => {
  expect(await AIModel.init(true)).not.toBeNull();
  // 不同模型可能产生不同结果
  // 下面为星火大模型测试结果

  // 正确率大概50%,有点低...但是勉强能用
  // 比如下面的AI回答D, 正确答案为A, 当我们帮助AI排除D, AI会选择A为答案
  const question1 = `（  ）是社会主义先进文化的集中体现。
    1 社会主义核心价值观
    2 儒家思想
    3 革命文化`
    // 4 中华优秀传统文化;

  // AI回答正确为C
  const question2 = `文化自信的显著特点是（  ）。
    1 实现文化传承
    2 坚守民族立场
    3 坚守中华文明立场
    4 人类共同价值`;

  await AIModel.instance!.getResponse(question1);
  await AIModel.instance!.getResponse(question2);
});

test('判断题测试', async () => {
  expect(await AIModel.init(true)).not.toBeNull();

  // AI回答A,正确答案为B
  const question1 = `文化自信是历史自信、文明自信生成的基础。
      1 正确
      2 错误`;

  // AI回答A, 正确答案为A
  const question2 = `精神上的独立自主是坚定文化自信的思想基础，也是文化发展的重要条件。
      1 正确
      2 错误`;

  await AIModel.instance!.getResponse(question1);
  await AIModel.instance!.getResponse(question2);
});
