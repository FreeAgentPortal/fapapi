import { AdvFilters } from '../AdvFilters';

describe('AdvFilters.query', () => {
  it('should create flat field regex filters', () => {
    const fields = ['name', 'email'];
    const keyword = 'john';
    const result = AdvFilters.query(fields, keyword);
    expect(result).toEqual([{ name: { $regex: 'john', $options: 'i' } }, { email: { $regex: 'john', $options: 'i' } }]);
  });

  it('should create nested $elemMatch filters', () => {
    const fields = ['[skills.name]', '[education.institution]'];
    const keyword = 'math';
    const result = AdvFilters.query(fields, keyword);
    expect(result).toEqual([
      { skills: { $elemMatch: { name: { $regex: 'math', $options: 'i' } } } },
      { education: { $elemMatch: { institution: { $regex: 'math', $options: 'i' } } } },
    ]);
  });

  it('should return [{}] if no keyword provided', () => {
    const fields = ['name'];
    const result = AdvFilters.query(fields, '');
    expect(result).toEqual([{}]);
  });

  it('should handle mix of nested and flat fields', () => {
    const fields = ['[skills.name]', 'email'];
    const keyword = 'developer';
    const result = AdvFilters.query(fields, keyword);
    expect(result).toEqual([{ skills: { $elemMatch: { name: { $regex: 'developer', $options: 'i' } } } }, { email: { $regex: 'developer', $options: 'i' } }]);
  });
});
