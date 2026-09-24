import mongoose from 'mongoose';

const dropLegacyDuplicateCodeIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const legacyIndexes = ['proposalCode_1', 'noteCode_1'];

    for (const indexName of legacyIndexes) {
      try {
        const collectionName = indexName.includes('proposal') ? 'purchaseproposals' : 'handovernotes';
        const collection = db.collection(collectionName);
        const indexInfo = await collection.indexInformation();

        if (indexInfo[indexName]) {
          await collection.dropIndex(indexName);
          console.log(`Dropped stale Mongo index: ${indexName}`);
        }
      } catch (error) {
        if (error?.codeName !== 'IndexNotFound') {
          console.warn(`Unable to inspect ${indexName}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to clean legacy duplicate-code indexes:', error.message);
  }
};

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables.');
    }

    await mongoose.connect(mongoUri);
    await dropLegacyDuplicateCodeIndexes();
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};
