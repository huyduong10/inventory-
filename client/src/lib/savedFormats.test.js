import { describe, it, expect } from 'vitest';
import { mergeDocuments, getDocumentIdentity, removeDocumentByIdentity } from './documentIdentity';
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

  it('merges duplicate saved and server documents that share the same document code', () => {
    const localDraft = {
      id: 'local-random-1',
      type: 'handover',
      data: { code: 'PBG-ABC123' },
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const serverRecord = {
      id: 'mongo-123',
      type: 'handover',
      data: { _id: 'mongo-123', code: 'PBG-ABC123' },
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    expect(getDocumentIdentity(localDraft)).toBe(getDocumentIdentity(serverRecord));
    expect(mergeDocuments([localDraft, serverRecord])).toHaveLength(1);
  });

  it('removes stale documents even when the server returns 404 for a missing record', () => {
    const documentList = [
      {
        id: 'local-gone-1',
        type: 'handover',
        data: { code: 'PBG-20260925-IAKP' },
        updatedAt: '2026-09-25T00:00:00.000Z',
      },
      {
        id: 'keep-me',
        type: 'handover',
        data: { code: 'PBG-999' },
        updatedAt: '2026-09-24T00:00:00.000Z',
      },
    ];

    const remaining = removeDocumentByIdentity(documentList, getDocumentIdentity(documentList[0]));

    expect(remaining).toHaveLength(1);
    expect(remaining[0].data.code).toBe('PBG-999');
  });
});
