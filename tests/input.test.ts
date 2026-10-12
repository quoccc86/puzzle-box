import { describe, expect, it } from 'vitest';
import { keyToDirection } from '../src/core/input';

describe('keyToDirection', () => {
  it('maps arrow keys', () => {
    expect(keyToDirection('ArrowUp')).toBe('up');
    expect(keyToDirection('ArrowDown')).toBe('down');
    expect(keyToDirection('ArrowLeft')).toBe('left');
    expect(keyToDirection('ArrowRight')).toBe('right');
  });

  it('maps WASD in both cases', () => {
    expect(keyToDirection('w')).toBe('up');
    expect(keyToDirection('W')).toBe('up');
    expect(keyToDirection('s')).toBe('down');
    expect(keyToDirection('S')).toBe('down');
    expect(keyToDirection('a')).toBe('left');
    expect(keyToDirection('A')).toBe('left');
    expect(keyToDirection('d')).toBe('right');
    expect(keyToDirection('D')).toBe('right');
  });

  it('unknown keys return null', () => {
    expect(keyToDirection('x')).toBeNull();
    expect(keyToDirection('Enter')).toBeNull();
    expect(keyToDirection('')).toBeNull();
    expect(keyToDirection('Escape')).toBeNull();
  });
});
