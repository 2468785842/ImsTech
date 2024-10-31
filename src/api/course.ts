import { AxiosResponse } from 'axios';
import { CourseType } from '../course/search.js';
import { newAxiosInstance } from './axiosInstance.js';

type ActivityType = 'learning_activities' | 'exams' | 'classrooms';

const Api = newAxiosInstance();

// https://lms.ouchn.cn/api/course/60000094011/all-activities?module_ids=[60000632770]&activity_types=learning_activities,exams,classrooms
function getAllActivities(
  courseId: number,
  moduleIds: number[],
  activityTypes: ActivityType[]
) {
  return Api.get(`course/${courseId}/all-activities`, {
    params: {
      module_ids: `[${moduleIds.join(',')}]`,
      activity_types: activityTypes.join(', ')
    }
  });
}

/**
 * 返回两个Cookie, 提交某些操作需要携带
 * @param courseType 
 * @param id 
 * @returns BENSESSCC_TAG session
 */
function activitiesRead(courseType: CourseType, id: number) {
  return new Promise<AxiosResponse>((resolve, reject) => {
    // 限制 Qps
    Api.post(`course/activities-read/${courseType}/${id}`)
      .then((v) => setTimeout(() => resolve(v), 5000))
      .catch(reject);
  });
}

export default {
  activitiesRead
};
