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
  const { courses } = (await Course.getMyCourses(1, 100)).data;

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
