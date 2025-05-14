import { AxiosResponse } from 'axios';
import { CourseType } from '../course/search.js';
import { newAxiosInstance } from './axiosInstance.js';

type ActivityType = 'learning_activities' | 'exams' | 'classrooms';

const Api = newAxiosInstance();

async function getMyCourses(page: number, page_size: number) {
  return await Api.get('my-courses', {
    params: {
      conditions: JSON.stringify({ status: ['ongoing'], keyword: '' }),
      fields: `id,name,course_code,department(id,name),grade(id,name),klass(id,name),course_type,cover,small_cover,start_date,end_date,is_started,is_closed,academic_year_id,semester_id,credit,compulsory,second_name,display_name,created_user(id,name),org(is_enterprise_or_organization),org_id,public_scope,course_attributes(teaching_class_name,copy_status,tip,data),audit_status,audit_remark,can_withdraw_course,imported_from,allow_clone,is_instructor,is_team_teaching,academic_year(id,name),semester(id,name),instructors(id,name,email,avatar_small_url),is_master,is_child,has_synchronized,master_course(name)`,
      page,
      page_size,
    },
  });
}

// https://lms.ouchn.cn/api/course/60000094011/all-activities?module_ids=[60000632770]&activity_types=learning_activities,exams,classrooms
async function getAllActivities(
  courseId: number,
  moduleIds: number[],
  activityTypes: ActivityType[],
) {
  return await Api.get(`course/${courseId}/all-activities`, {
    params: {
      module_ids: `[${moduleIds.join(',')}]`,
      activity_types: activityTypes.join(', '),
    },
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
  activitiesRead,
  getMyCourses,
};
