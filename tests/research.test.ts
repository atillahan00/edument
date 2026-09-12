import { expect, it } from 'vitest';
import { summarize } from '../apps/api/src/research.service';
it('reports an actual median for odd and even sample counts', () => {
  expect(summarize([4, 1, 2, 3])).toEqual({ mean: 2.5, median: 2.5, p95: 4 });
  expect(summarize([9, 1, 3]).median).toBe(3);
});
