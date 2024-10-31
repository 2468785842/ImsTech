import 'dotenv/config';

const BASE_SSO_URL = 'https://iam.pt.ouchn.cn/am/UI/Login';

const API_BASE_URL = 'https://lms.ouchn.cn';

const { _PROXY_HOST: host, _PROXY_PORT: port } = process.env;

console.assert(host && port, 'proxy:', `http://${host}:${port}`);

const Config = {
  urls: {
    login: () => BASE_SSO_URL,
    user: () => `${API_BASE_URL}/user`,
    course: () => `${API_BASE_URL}/course`,
    home: () => `${Config.urls.user()}/index#/`
    // modules: (courseId: string) => `https://lms.ouchn/api/courses/${courseId}/modules`,
  },
  proxy: host && port ? { host: host!, port: Number(port) } : void 0
};

export default Config;

export { API_BASE_URL };
