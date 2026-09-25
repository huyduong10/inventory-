import { describe, expect, it } from 'vitest';
import { filterProductsAfterDelete } from './productDelete.js';

describe('filterProductsAfterDelete', () => {
  it('keeps the product in the list when the backend delete fails', () => {
    const products = [
      { _id: 'p1', name: 'Bút bi' },
      { _id: 'p2', name: 'Giấy A4' },
    ];

    expect(filterProductsAfterDelete(products, 'p1', false)).toEqual(products);
  });

  it('removes the product from the list when the backend delete succeeds', () => {
    const products = [
      { _id: 'p1', name: 'Bút bi' },
      { _id: 'p2', name: 'Giấy A4' },
    ];

    expect(filterProductsAfterDelete(products, 'p1', true)).toEqual([
      { _id: 'p2', name: 'Giấy A4' },
    ]);
  });
});
