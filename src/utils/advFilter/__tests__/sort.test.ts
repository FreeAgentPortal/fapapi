import { AdvFilters } from "../AdvFilters";

describe('AdvFilters.sort', () => {
  it('should convert sort string to Mongo sort object', () => {
    const input = '-createdAt;name';
    const result = AdvFilters.sort(input);
    expect(result).toEqual({ createdAt: -1, name: 1 });
  });

  it('should handle empty sort string', () => {
    const result = AdvFilters.sort('');
    expect(result).toEqual({});
  });
});
