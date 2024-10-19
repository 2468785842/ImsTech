
import 'dotenv/config';

const envData = process.env;

const Config = {
  urls: {
    login: () => 'https://iam.pt.ouchn.cn/am/UI/Login',
    user: () => 'https://lms.ouchn.cn/user',
    home: () => `${Config.urls.user()}/index#/`,
    course: () => 'https://lms.ouchn.cn/course'
  }
};


export default Config;
