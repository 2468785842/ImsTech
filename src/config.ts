import 'dotenv/config';

const BASE_SSO_URL = 'https://iam.pt.ouchn.cn/am/UI/Login';

const API_BASE_URL = 'https://lms.ouchn.cn';

const Config = {
  urls: {
    login: () => BASE_SSO_URL,
    user: () => `${API_BASE_URL}/user`,
    course: () => `${API_BASE_URL}/course`,
    home: () => `${Config.urls.user()}/index#/`,
    // modules: (courseId: string) => `https://lms.ouchn/api/courses/${courseId}/modules`,
  }
};

export default Config;

export {
  API_BASE_URL
}