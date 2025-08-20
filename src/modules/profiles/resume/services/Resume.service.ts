import { CRUDService } from "../../../../utils/baseCRUD";
import ResumeCRUDHandler from "../handlers/ResumeCRUD.handler";

export default class ResumeService extends CRUDService {
  constructor() {
    super(ResumeCRUDHandler);
  }
}