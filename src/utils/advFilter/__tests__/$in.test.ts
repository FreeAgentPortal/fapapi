import { AdvFilters } from '../AdvFilters';

describe('AdvFilters - $in operator parsing', () => {
  it('parses a single value for $in', () => {
    const query = AdvFilters.filter('key;{"$in":"value"}');

    expect(query).toEqual([
      {
        key: { $in: ['value'] },
      },
    ]);
  });

  it('parses multiple comma-separated values for $in', () => {
    const query = AdvFilters.filter('key;{"$in":"value,value2"}');

    expect(query).toEqual([
      {
        key: { $in: ['value', 'value2'] },
      },
    ]);
  });
});
