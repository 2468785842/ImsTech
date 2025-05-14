import test from '@playwright/test';
// import Exam from '../src/api/Exam.js';
import Course from '../src/api/course.js'

// test('获取考试信息', async () => {
//   const exam = new Exam(60000512656);

//   // const questionInfo = await exam.get();
//   // console.log('questionInfo', questionInfo);
//   // const distribute = await exam.getDistribute();
//   // console.log('distribute', distribute);
//   const subjectsSummary = await exam.getSubjectsSummary(true);
//   console.log('subjectsSummary', subjectsSummary);
//   // const submissions = await exam.getSubmissions();
//   // console.log('submissions', submissions);
// });

test('获取我的课程',async () => {
    console.log((await Course.getMyCourses(1, 100)).data);
});