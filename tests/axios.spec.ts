import test, { expect } from '@playwright/test';
import Exam from '../src/api/Exam.js';

test('获取考试信息', async () => {
  const r = await new Exam(60000512656).get();
  console.log(r);
});
