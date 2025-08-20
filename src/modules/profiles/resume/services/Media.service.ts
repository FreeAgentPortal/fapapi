import { CRUDService } from '../../../../utils/baseCRUD';
import MediaCRUDHandler from '../handlers/MediaCRUD.handler';

export default class MediaService extends CRUDService {
  constructor() {
    super(MediaCRUDHandler);
  }
}
