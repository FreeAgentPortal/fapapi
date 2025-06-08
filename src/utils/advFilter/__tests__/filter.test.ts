import { AdvFilters } from '../AdvFilters';

describe('AdvFilters.filter', () => {
  it('should parse min and max ranges correctly', () => {
    const input = `age;{"$gte": "18", "$lte": "25"}|weight;{"$gte": "180"}`;
    const result = AdvFilters.filter(input);

    expect(result).toEqual([
      {
        age: { $gte: 18, $lte: 25 },
        weight: { $gte: 180 },
      },
    ]);
  });

  it('should return an empty object when input is empty', () => {
    const result = AdvFilters.filter(``);
    expect(result).toEqual([{}]);
  });
});
