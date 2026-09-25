import { describe, it, expect } from 'vitest';
import { getSavedFormats, upsertSavedFormat, deleteSavedFormat } from './savedFormats';

describe('saved format helpers', () => {
  it('adds and reuses saved formats', () => {
    const before = getSavedFormats();
    const saved = upsertSavedFormat({
      id: 'proposal-1',
      type: 'purchase',
      name: 'Format đề xuất mặc định',
      data: { proposer: 'Nguyễn Văn A' },
    });

    expect(saved).toHaveLength(before.length + 1);
    expect(saved[0]).toMatchObject({
      name: 'Format đề xuất mặc định',
      type: 'purchase',
    });

    const deleted = deleteSavedFormat('proposal-1');
    expect(deleted.some((format) => format.id === 'proposal-1')).toBe(false);
  });
});
