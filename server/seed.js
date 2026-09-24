import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product.js';

dotenv.config();

const seedProducts = [
  {
    name: 'Bút bi Thiên Long',
    sku: 'BN-001',
    category: 'Bút',
    unit: 'Cái',
    quantity: 120,
    minThreshold: 25,
    description: 'Bút bi văn phòng phẩm',
  },
  {
    name: 'Giấy Double A A4',
    sku: 'GI-001',
    category: 'Giấy',
    unit: 'Ram',
    quantity: 40,
    minThreshold: 10,
    description: 'Giấy in A4',
  },
  {
    name: 'Băng keo 2 inch',
    sku: 'BK-001',
    category: 'Dán',
    unit: 'Cuộn',
    quantity: 18,
    minThreshold: 6,
    description: 'Băng keo văn phòng',
  },
  {
    name: 'Kẹp ghim',
    sku: 'KG-001',
    category: 'Dụng cụ',
    unit: 'Hộp',
    quantity: 12,
    minThreshold: 8,
    description: 'Kẹp ghim giấy',
  },
  {
    name: 'Sổ tay A5',
    sku: 'ST-001',
    category: 'Văn phòng phẩm',
    unit: 'Cái',
    quantity: 7,
    minThreshold: 8,
    description: 'Sổ tay ghi chép',
  },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_management');
    await Product.deleteMany({});
    await Product.insertMany(seedProducts);
    console.log('Seed data inserted successfully.');
  } catch (error) {
    console.error('Seed failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

seedDatabase();
