import { CRUDHandler } from '../../../utils/baseCRUD';
import SearchPreferences, { ISearchPreferences } from '../models/SearchPreferences';

export class SearchPreferencesHandler extends CRUDHandler<ISearchPreferences> {
  constructor() {
    super(SearchPreferences);
  }
}
