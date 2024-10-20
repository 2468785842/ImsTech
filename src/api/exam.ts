import axiosInstance from './axiosInstance.js';
import Api from './axiosInstance.js';

export default class {
  activityId: number;

  constructor(activityId: number) {
    this.activityId = activityId;
  }

  getBaseUrl() {
    return `exams/${this.activityId}`;
  }

  async get() {
    const response = await Api.get(this.getBaseUrl());
    console.assert(response.status != 200, response.statusText);
    return JSON.parse(response.data);
  }

// {
//     "subjects": [
//         {
//             "has_audio": false,
//             "id": 60022713235,
//             "point": "0.0",
//             "sub_subjects": [],
//             "type": "text"
//         },
//         {
//             "has_audio": false,
//             "id": 60022713237,
//             "point": "25.0",
//             "sub_subjects": [],
//             "type": "single_selection"
//         },
//         {
//             "has_audio": false,
//             "id": 60022713239,
//             "point": "25.0",
//             "sub_subjects": [],
//             "type": "single_selection"
//         },
//         {
//             "has_audio": false,
//             "id": 60022713241,
//             "point": "0.0",
//             "sub_subjects": [],
//             "type": "text"
//         },
//         {
//             "has_audio": false,
//             "id": 60022713243,
//             "point": "25.0",
//             "sub_subjects": [],
//             "type": "true_or_false"
//         },
//         {
//             "has_audio": false,
//             "id": 60022713245,
//             "point": "25.0",
//             "sub_subjects": [],
//             "type": "true_or_false"
//         }
//     ]
// }
  async subjectsSummary(forAllSubjects: boolean) {
    const response = await axiosInstance.get(
      `${this.getBaseUrl()}/subject-summary`,
      {
        params: {
          forAllSubjects
        }
      }
    );
    console.assert(response.status != 200, response.statusText);
    return JSON.parse(response.data);
  }

}
