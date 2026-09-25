import test from 'node:test';
import assert from 'node:assert/strict';

import Product from '../src/models/Product.js';
import HandoverNote from '../src/models/HandoverNote.js';
import { createHandoverNote } from '../src/controllers/handoverController.js';

test('createHandoverNote decrements stock when status is provided in lowercase', async () => {
  const productId = '507f1f77bcf86cd799439011';
  const originalFindById = Product.findById;
  const originalFindOne = Product.findOne;
  const originalFindByIdAndUpdate = Product.findByIdAndUpdate;
  const originalNoteSave = HandoverNote.prototype.save;
  const originalNoteFindById = HandoverNote.findById;

  try {
    const product = {
      _id: productId,
      name: 'Máy in',
      sku: 'MI-01',
      unit: 'Cái',
      quantity: 15,
    };

    const updateCalls = [];

    Product.findById = async (id) => {
      if (String(id) === productId) return product;
      return null;
    };
    Product.findOne = async () => null;
    Product.findByIdAndUpdate = async (id, update) => {
      updateCalls.push({ id: String(id), update });
      return { ...product, quantity: product.quantity - Number(update.$inc.quantity) };
    };
    HandoverNote.prototype.save = async function saveMock() {
      this._id = 'note-123';
      return this;
    };
    HandoverNote.findById = () => ({
      populate: () => ({
        _id: 'note-123',
        items: [{ product: { name: product.name, sku: product.sku, unit: product.unit, quantity: product.quantity } }],
      }),
    });

    const req = {
      body: {
        status: 'completed',
        items: [{ product: productId, quantity: 2 }],
      },
    };

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return payload;
      },
    };

    let error;
    await createHandoverNote(req, res, (nextError) => {
      error = nextError;
    });

    assert.equal(error, undefined, `Expected no controller error, got: ${error?.message || error}`);
    assert.equal(updateCalls.length, 1, 'Expected stock to be decremented once');
    assert.equal(updateCalls[0].update.$inc.quantity, -2, 'Expected quantity decrement of 2');
    assert.equal(res.statusCode, 201, 'Expected created status');
  } finally {
    Product.findById = originalFindById;
    Product.findOne = originalFindOne;
    Product.findByIdAndUpdate = originalFindByIdAndUpdate;
    HandoverNote.prototype.save = originalNoteSave;
    HandoverNote.findById = originalNoteFindById;
  }
});
