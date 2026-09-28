const makeDateStamp = () => {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: now.getFullYear(),
    yearMonth: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`,
    day: String(now.getDate()).padStart(2, '0'),
  };
};

export const DEPARTMENT_ABBR = {
  'Kế toán': 'KT',
  'Hành chính nhân sự': 'HCNS',
  'Thu mua': 'TM',
  'IT': 'IT',
  'Ban Giám đốc': 'BGĐ',
  'Quản lí dự án': 'QLDA',
  KT: 'KT',
  HCNS: 'HCNS',
  TM: 'TM',
  IT: 'IT',
  BGĐ: 'BGĐ',
  QLDA: 'QLDA',
};

export const isDuplicateKeyError = (error) => error?.code === 11000 || (error?.name === 'MongoServerError' && error?.code === 11000);

export const generateProposalCode = () => {
  const { yearMonth, day } = makeDateStamp();
  const suffix = `${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  return `DXMS-${yearMonth}-${day}-${suffix}`;
};

export const generateHandoverCode = (department = 'IT', suffix = '') => {
  const { month, year } = makeDateStamp();
  const tag = DEPARTMENT_ABBR[department] || department || 'IT';
  if (suffix) {
    return `${month}${year}/ĐXMS-${tag}-${suffix}`;
  }
  return `${month}${year}/ĐXMS-${tag}`;
};
