import { Axios, HttpStatusCode } from 'axios';
import { API_BASE_URL } from '../config.js';
import { restoreCookies } from '../login.js';
import { exit } from 'process';

function newAxiosInstance(url: string = '') {
  if (url) url = '/' + url;
  const axiosInstance = new Axios({
    baseURL: `${API_BASE_URL}/api${url}`,
    withCredentials: true,
    timeout: 5000
    // proxy: {
    //   host: 'localhost',
    //   port: 8888,
    //   protocol: 'http'
    // }
  });

  axiosInstance.interceptors.request.use(
    async (config) => {
      config.headers['User-Agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

      config.headers['Cookie'] = (await restoreCookies())
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');

      return config;
    },
    (error) => {
      console.error(error);
      return Promise.reject(error);
    }
  );

  axiosInstance.interceptors.response.use(async (response) => {
    switch (response.status) {
      case HttpStatusCode.Found:
      case HttpStatusCode.BadRequest:
        console.warn('获取信息失败', '需要登陆?');
        exit();
    }
    return response;
  });

  return axiosInstance;
}

export { newAxiosInstance };
