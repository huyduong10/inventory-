const makeDateStamp = () => {
  const now = new Date();
  return {
    yearMonth: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`,
    day: String(now.getDate()).padStart(2, '0'),
  };
};

export const isDuplicateKeyError = (error) => error?.code === 11000 || (error?.name === 'MongoServerError' && error?.code === 11000);

export const generateProposalCode = () => {
  const { yearMonth, day } = makeDateStamp();
  const suffix = `${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  return `DXMS-${yearMonth}-${day}-${suffix}`;
};

export const generateHandoverCode = () => {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStamp = now.getTime().toString(36).slice(-6).toUpperCase();
  const suffix = `${timeStamp}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return `PBG-${dateKey}-${suffix}`;
};
