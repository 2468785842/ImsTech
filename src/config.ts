import 'dotenv/config';

const envData = process.env;
const BASE_SSO_URL = 'https://iam.pt.ouchn.cn/am/UI/Login';

const API_BASE_URL = 'https://lms.ouchn.cn/';

const Config = {
  urls: {
    login: () => BASE_SSO_URL,
    user: () => 'https://lms.ouchn.cn/user',
    home: () => `${Config.urls.user()}/index#/`,
    course: () => 'https://lms.ouchn.cn/course'
    // modules: (courseId: string) => `https://lms.ouchn/api/courses/${courseId}/modules`,
  }
};

export default Config;

export {
  API_BASE_URL
}