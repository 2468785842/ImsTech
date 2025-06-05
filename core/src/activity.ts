import Course from '../src/api/course.js';

interface ActivityInfo {
  id: number;
  title: string;
  semester: string;
  code: string;
  startDate: string;
  percent: string;
}

async function getActivities(): Promise<ActivityInfo[]> {
  const resp = await Course.getMyCourses(1, 100);
  console.log('getMyCourses 返回内容:', resp);
  const data = resp.data;
  if (!data || !Array.isArray(data.courses)) {
    console.warn('getMyCourses 返回数据结构异常:', data);
    return [];
  }
  const { courses } = data;
  return courses.map((course: any) => ({
    id: course.id,
    title: course.name,
    semester: course.semester.name,
    code: course.course_code,
    startDate: course.start_date,
    percent: course.completeness,
  }));
}

export { ActivityInfo, getActivities };
