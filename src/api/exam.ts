import Api from './axiosInstance.js';

// https://lms.ouchn.cn/api/exams/60000512656
async function getExam(activityId: number) {
  return JSON.parse((await Api.get(`exams/${activityId}`)).data);
}

export { getExam };
