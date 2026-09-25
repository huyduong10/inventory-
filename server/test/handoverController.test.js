import test from 'node:test';
import assert from 'node:assert/strict';

import Product from '../src/models/Product.js';
import HandoverNote from '../src/models/HandoverNote.js';
import { createHandoverNote, deleteHandoverNote } from '../src/controllers/handoverController.js';

test('createHandoverNote decrements stock when status is provided in lowercase', async () => {
  const productId = '507f1f77bcf86cd799439011';
  const originalFindById = Product.findById;
  const originalFindOne = Product.findOne;
  const originalFind = Product.find;
  const originalFindByIdAndUpdate = Product.findByIdAndUpdate;
  const originalFindOneAndUpdate = Product.findOneAndUpdate;
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
    Product.find = async () => [product];
    Product.findByIdAndUpdate = async (id, update) => {
      updateCalls.push({ id: String(id), update });
      return { ...product, quantity: product.quantity - Number(update.$inc.quantity) };
    };
    Product.findOneAndUpdate = async (filter, update) => {
      updateCalls.push({ filter, update });
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
    Product.find = originalFind;
    Product.findByIdAndUpdate = originalFindByIdAndUpdate;
    Product.findOneAndUpdate = originalFindOneAndUpdate;
    HandoverNote.prototype.save = originalNoteSave;
    HandoverNote.findById = originalNoteFindById;
  }
});

test('createHandoverNote uses the shared guarded stock decrement before saving the note', async () => {
  const productId = '507f1f77bcf86cd799439011';
  const originalFindById = Product.findById;
  const originalFindOne = Product.findOne;
  const originalFind = Product.find;
  const originalFindByIdAndUpdate = Product.findByIdAndUpdate;
  const originalFindOneAndUpdate = Product.findOneAndUpdate;
  const originalNoteSave = HandoverNote.prototype.save;
  const originalNoteFindById = HandoverNote.findById;

  try {
    const product = {
      _id: productId,
      name: 'Máy in',
      sku: 'MI-01',
      unit: 'Cái',
      quantity: 10,
    };

    const guardedUpdateCalls = [];

    Product.findById = async (id) => {
      if (String(id) === productId) return product;
      return null;
    };
    Product.findOne = async () => null;
    Product.find = async () => [product];
    Product.findByIdAndUpdate = async () => {
      throw new Error('Legacy direct findByIdAndUpdate should not be used for handover stock decrement');
    };
    Product.findOneAndUpdate = async (filter, update) => {
      guardedUpdateCalls.push({ filter, update });
      return { ...product, quantity: product.quantity + Number(update.$inc.quantity) };
    };
    HandoverNote.prototype.save = async function saveMock() {
      this._id = 'note-456';
      return this;
    };
    HandoverNote.findById = () => ({
      populate: () => ({
        _id: 'note-456',
        items: [{ product: { name: product.name, sku: product.sku, unit: product.unit, quantity: product.quantity } }],
      }),
    });

    const req = {
      body: {
        items: [{ product: productId, quantity: 3 }],
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

    await createHandoverNote(req, res, (error) => {
      assert.ifError(error);
    });

    assert.equal(guardedUpdateCalls.length, 1, 'Expected guarded stock decrement to run exactly once');
    assert.deepEqual(guardedUpdateCalls[0].filter, { _id: productId, quantity: { $gte: 3 } }, 'Expected guarded stock decrement to validate available quantity before reducing stock');
    assert.equal(guardedUpdateCalls[0].update.$inc.quantity, -3, 'Expected decrement of 3 units');
    assert.equal(res.statusCode, 201, 'Expected created status');
  } finally {
    Product.findById = originalFindById;
    Product.findOne = originalFindOne;
    Product.find = originalFind;
    Product.findByIdAndUpdate = originalFindByIdAndUpdate;
    Product.findOneAndUpdate = originalFindOneAndUpdate;
    HandoverNote.prototype.save = originalNoteSave;
    HandoverNote.findById = originalNoteFindById;
  }
});

test('deleteHandoverNote still deletes a completed note even when the referenced product is already missing', async () => {
  const productId = '507f1f77bcf86cd799439011';
  const originalFindById = Product.findById;

  try {
    const note = {
      _id: 'note-missing-product',
      status: 'Completed',
      items: [{ product: productId, quantity: 2 }],
      deleteOne: async () => ({ deleted: true }),
    };

    HandoverNote.findById = async () => note;
    Product.findById = async () => null;

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

    let nextError;
    await deleteHandoverNote({ params: { id: 'note-missing-product' } }, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined, `Expected delete to succeed without error, got: ${nextError?.message || nextError}`);
    assert.equal(res.statusCode, 200, 'Expected successful delete status');
    assert.equal(res.payload.success, true, 'Expected success payload');
  } finally {
    Product.findById = originalFindById;
  }
});

test('createHandoverNote retries with a new unique code when the supplied code already exists', async () => {
  const productId = '507f1f77bcf86cd799439011';
  const originalFindById = Product.findById;
  const originalFindOne = Product.findOne;
  const originalFind = Product.find;
  const originalFindByIdAndUpdate = Product.findByIdAndUpdate;
  const originalFindOneAndUpdate = Product.findOneAndUpdate;
  const originalNoteSave = HandoverNote.prototype.save;
  const originalNoteFindById = HandoverNote.findById;

  try {
    const product = {
      _id: productId,
      name: 'Máy in',
      sku: 'MI-01',
      unit: 'Cái',
      quantity: 20,
    };

    Product.findById = async (id) => {
      if (String(id) === productId) return product;
      return null;
    };
    Product.findOne = async () => null;
    Product.find = async () => [product];
    Product.findByIdAndUpdate = async () => ({ ...product, quantity: product.quantity });
    Product.findOneAndUpdate = async (filter, update) => ({
      ...product,
      quantity: product.quantity + Number(update.$inc.quantity),
    });

    const saveCalls = [];
    HandoverNote.prototype.save = async function saveMock() {
      saveCalls.push(this.code);
      if (saveCalls.length === 1) {
        const error = new Error('E11000 duplicate key error');
        error.code = 11000;
        error.name = 'MongoServerError';
        throw error;
      }
      this._id = 'note-dup-retry';
      return this;
    };
    HandoverNote.findById = () => ({
      populate: () => ({
        _id: 'note-dup-retry',
        items: [{ product: { name: product.name, sku: product.sku, unit: product.unit, quantity: product.quantity } }],
      }),
    });

    const req = {
      body: {
        code: 'PBG-001',
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

    await createHandoverNote(req, res, (error) => {
      assert.ifError(error);
    });

    assert.equal(saveCalls.length, 2, 'Expected the duplicate-code save to retry once with a fresh code');
    assert.notEqual(saveCalls[0], saveCalls[1], 'Expected a new code to be generated on retry');
    assert.equal(res.statusCode, 201, 'Expected the retry to succeed');
  } finally {
    Product.findById = originalFindById;
    Product.findOne = originalFindOne;
    Product.find = originalFind;
    Product.findByIdAndUpdate = originalFindByIdAndUpdate;
    Product.findOneAndUpdate = originalFindOneAndUpdate;
    HandoverNote.prototype.save = originalNoteSave;
    HandoverNote.findById = originalNoteFindById;
  }
});
