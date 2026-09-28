import { describe, it, expect } from 'vitest';

describe('Environment & Test Runner Sanity Check', () => {
  it('should run tests correctly with Vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have correct Node environment', () => {
    expect(process.version).toBeDefined();
  });
});
