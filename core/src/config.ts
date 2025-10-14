import chalk from 'chalk';
import 'dotenv/config';

const BASE_SSO_URL = 'https://iam.pt.ouchn.cn/am';

const API_BASE_URL = 'https://lms.ouchn.cn';

const { _PROXY_HOST: host, _PROXY_PORT: port } = process.env;
const { _API: api, _KEY: key, _MODEL: model, _Qps } = process.env;
const qps = Number(_Qps) || 1;

const { _ACCOUNT: account, _PASSWORD: password } = process.env;

// 获取随机延迟时间
function getRandomDelay() {
  const min = Number(process.env._SLOW_MO_MIN ?? process.env._SLOW_MO ?? 1000);
  const max = Number(process.env._SLOW_MO_MAX ?? process.env._SLOW_MO ?? 1000);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
    slowMo: getRandomDelay,
  },
  playRate: Number(process.env._PLAY_RATE ?? 8),
  totalPoints: Number(process.env._TOTAL_POINTS ?? 100),
};

const checkUnicode = (v: any) => (v ? chalk.green('✓') : chalk.red('✘'));

console.log('无头模式:', checkUnicode(Config.browser.headless));

console.log('视频倍速:', Config.playRate);
console.log('考试分数及格线(百分比):', Config.totalPoints);

console.log('检查AI设置:');
console.log('API', checkUnicode(Config.ai.api));
console.log('Key', checkUnicode(Config.ai.key));
console.log('Model', checkUnicode(Config.ai.model));

if (Config.proxy) {
  console.log(
    '代理:',
    chalk.green(`http://${Config.proxy.host}:${Config.proxy.port}`),
  );
}

export default Config;

export { API_BASE_URL };
