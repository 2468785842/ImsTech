import chalk from 'chalk';
import 'dotenv/config';

const BASE_SSO_URL = 'https://iam.pt.ouchn.cn/am';

const API_BASE_URL = 'https://lms.ouchn.cn';

const { _PROXY_HOST: host, _PROXY_PORT: port } = process.env;
const { _API: api, _KEY: key, _MODEL: model, _Qps } = process.env;
const qps = Number(_Qps) || 1;

const { _ACCOUNT: account, _PASSWORD: password } = process.env;

const Config = {
  user: {
    account,
    password,
  },
  urls: {
    login: () => BASE_SSO_URL,
    user: () => `${API_BASE_URL}/user`,
    course: () => `${API_BASE_URL}/course`,
    home: () => `${Config.urls.user()}/index#/`,
    // modules: (courseId: string) => `https://lms.ouchn/api/courses/${courseId}/modules`,
  },
  proxy: host && port ? { host: host!, port: Number(port) } : void 0,
  ai: { api, key, model, qps },

  browser: {
    headless: !!process.env._HEAD_LESS,
    slowMo() {
      const min = Number(process.env._SLOW_MO_MIN ?? 6000);
      const max = Number(process.env._SLOW_MO_MAX ?? 9000);
      console.assert(max > min);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
  },
  playRate: Number(process.env._PLAY_RATE ?? 8),
  totalPoints: Number(process.env._TOTAL_POINTS ?? 100),
};

function printConfigStatus() {
  console.log('视频倍速:', Config.playRate);
  console.log('考试分数及格线(百分比):', Config.totalPoints);

  if (Config.browser.headless) {
    console.log('无头模式已启用');
  }

  if (Config.ai && Config.ai.api && Config.ai.key && Config.ai.model) {
    console.log('AI已启用:');
    console.log('API', Config.ai.api);
    console.log('Key', '*'.repeat(Config.ai.key.length));
    console.log('Model', Config.ai.model);
  }

  if (Config.proxy) {
    console.log(
      '代理:',
      chalk.green(`http://${Config.proxy.host}:${Config.proxy.port}`),
    );
  }
}

export default Config;

export { API_BASE_URL, printConfigStatus };
