import test, { expect } from '@playwright/test';
import * as Exam from '../src/api/exam.js';

test('获取考试信息', async () => {
  const r = await Exam.getExam(60000512656);
  console.log(r);
});
