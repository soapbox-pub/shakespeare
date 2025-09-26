import { describe, it, expect } from 'vitest';
import z from 'zod';
import { filteredArray } from './schema';

describe('filteredArray', () => {
  it('filters out invalid items and keeps valid ones', () => {
    const numberSchema = z.number();
    const schema = filteredArray(numberSchema);
    
    const input = [1, 'invalid', 2, null, 3, undefined, 4];
    const result = schema.parse(input);
    
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('returns empty array when all items are invalid', () => {
    const numberSchema = z.number();
    const schema = filteredArray(numberSchema);
    
    const input = ['string', null, undefined, {}, []];
    const result = schema.parse(input);
    
    expect(result).toEqual([]);
  });

  it('returns all items when all are valid', () => {
    const stringSchema = z.string();
    const schema = filteredArray(stringSchema);
    
    const input = ['hello', 'world', 'test'];
    const result = schema.parse(input);
    
    expect(result).toEqual(['hello', 'world', 'test']);
  });

  it('works with complex object schemas', () => {
    const userSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
    });
    const schema = filteredArray(userSchema);
    
    const input = [
      { id: 1, name: 'John', email: 'john@example.com' },
      { id: 'invalid', name: 'Jane', email: 'jane@example.com' }, // invalid id
      { id: 2, name: 'Bob', email: 'invalid-email' }, // invalid email
      { id: 3, name: 'Alice', email: 'alice@example.com' },
      'not an object',
      null,
    ];
    
    const result = schema.parse(input);
    
    expect(result).toEqual([
      { id: 1, name: 'John', email: 'john@example.com' },
      { id: 3, name: 'Alice', email: 'alice@example.com' },
    ]);
  });

  it('handles empty array input', () => {
    const numberSchema = z.number();
    const schema = filteredArray(numberSchema);
    
    const result = schema.parse([]);
    
    expect(result).toEqual([]);
  });

  it('catches non-array input and returns empty array', () => {
    const numberSchema = z.number();
    const schema = filteredArray(numberSchema);
    
    const result1 = schema.parse('not an array');
    const result2 = schema.parse(null);
    const result3 = schema.parse(undefined);
    const result4 = schema.parse(123);
    
    expect(result1).toEqual([]);
    expect(result2).toEqual([]);
    expect(result3).toEqual([]);
    expect(result4).toEqual([]);
  });

  it('works with union schemas', () => {
    const unionSchema = z.union([z.string(), z.number()]);
    const schema = filteredArray(unionSchema);
    
    const input = ['hello', 42, true, 'world', null, 99, {}];
    const result = schema.parse(input);
    
    expect(result).toEqual(['hello', 42, 'world', 99]);
  });

  it('preserves transformed values from schema', () => {
    const transformSchema = z.string().transform((str) => str.toUpperCase());
    const schema = filteredArray(transformSchema);
    
    const input = ['hello', 123, 'world', null, 'test'];
    const result = schema.parse(input);
    
    expect(result).toEqual(['HELLO', 'WORLD', 'TEST']);
  });

  it('works with optional fields in object schemas', () => {
    const optionalSchema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });
    const schema = filteredArray(optionalSchema);
    
    const input = [
      { required: 'test1' },
      { required: 'test2', optional: 'value' },
      { optional: 'value' }, // missing required field
      { required: 'test3', optional: undefined },
    ];
    
    const result = schema.parse(input);
    
    expect(result).toEqual([
      { required: 'test1' },
      { required: 'test2', optional: 'value' },
      { required: 'test3', optional: undefined },
    ]);
  });

  it('handles nested arrays', () => {
    const nestedSchema = z.object({
      name: z.string(),
      tags: z.string().array(),
    });
    const schema = filteredArray(nestedSchema);
    
    const input = [
      { name: 'item1', tags: ['tag1', 'tag2'] },
      { name: 'item2', tags: 'not an array' }, // invalid tags
      { name: 'item3', tags: [] },
      'invalid item',
    ];
    
    const result = schema.parse(input);
    
    expect(result).toEqual([
      { name: 'item1', tags: ['tag1', 'tag2'] },
      { name: 'item3', tags: [] },
    ]);
  });
});