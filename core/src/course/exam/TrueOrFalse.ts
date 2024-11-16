import { SubjectType } from '../../api/Exam.js';
import SingleSelection from './SingleSelection.js';

class TrueOrFalse extends SingleSelection {
  protected type: SubjectType = 'true_or_false';
}

export default TrueOrFalse;
