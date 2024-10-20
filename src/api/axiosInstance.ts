import { Axios } from 'axios';
import { API_BASE_URL } from '../config.js';
import { restoreCookies } from '../Login.js';

const axiosInstance = new Axios({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  timeout: 5000
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

export default axiosInstance;
