import test, { expect } from '@playwright/test';
import AIModel from '../src/ai/AIModel.js';
import ExamProc from '../src/course/processor/ExamProc.js';

test('测试考试答题', async ({ page }) => {
  const aiModel = AIModel.init(true);
  expect(await aiModel, '连接失败').not.toBeNull();
  const exam = new ExamProc();
  await exam.condition({
    moduleId: '??',
    moduleName: '??',
    syllabusId: null,
    syllabusName: null,
    activityId: 60000502885,
    activityName: '??',
    type: 'exam',
    progress: 'part'
  });
  await exam.exec(page);
});
