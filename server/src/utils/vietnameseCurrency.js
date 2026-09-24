const ones = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
];

const readUnderOneThousand = (value) => {
  if (value === 0) return '';

  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const tens = Math.floor(remainder / 10);
  const units = remainder % 10;

  let words = '';

  if (hundreds > 0) {
    words += `${ones[hundreds]} trăm`;
  }

  if (tens === 1) {
    words += ` mười`;
  } else if (tens > 1) {
    words += ` ${ones[tens]} mươi`;
  }

  if (units > 0) {
    if (tens > 1 && units === 1) {
      words += ' mốt';
    } else if (units === 5 && tens > 0) {
      words += ' lăm';
    } else if (units === 4 && tens > 0) {
      words += ' tư';
    } else {
      words += ` ${ones[units]}`;
    }
  }

  return words.trim();
};

export const numberToVietnameseWords = (value) => {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount < 0) {
    return 'Số không hợp lệ';
  }

  if (amount === 0) {
    return 'không';
  }

  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  const groups = [];
  let remaining = Math.floor(amount);

  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const chunks = groups.map((group, index) => {
    const chunkText = readUnderOneThousand(group);
    if (!chunkText) return '';
    const unitName = units[index] || '';
    return unitName ? `${chunkText} ${unitName}` : chunkText;
  });

  return chunks.reverse().join(' ').trim();
};

export const formatVietnameseCurrency = (value, suffix = 'đồng') => {
  const amount = Math.round(Number(value || 0));
  const words = numberToVietnameseWords(amount);

  return `${words} ${suffix}`.trim();
};

export default {
  numberToVietnameseWords,
  formatVietnameseCurrency,
};
