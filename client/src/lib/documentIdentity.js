export const getDocumentIdentity = (document) => {
  if (!document) return null;

  const type = document.type || 'unknown';
  const values = [
    document?.data?.code,
    document?.data?.noteCode,
    document?.data?.proposalCode,
    document?.data?._id,
    document?._id,
    document?.data?.id,
    document?.data?.name,
    document?.code,
    document?.id,
    document?.name,
  ];

  const canonicalValue = values
    .map((value) => (value === undefined || value === null ? '' : String(value).trim()))
    .find(Boolean);

  if (!canonicalValue) {
    return null;
  }

  return `${type}:${canonicalValue}`;
};

export const mergeDocuments = (documentList = []) => {
  const seen = new Map();

  for (const document of documentList) {
    if (!document) continue;

    const key = getDocumentIdentity(document);
    if (!key) continue;

    if (!seen.has(key)) {
      seen.set(key, document);
    }
  }

  return [...seen.values()].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || left.data?.updatedAt || left.data?.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || right.data?.updatedAt || right.data?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
};

export const removeDocumentByIdentity = (documentList = [], identity) => {
  if (!identity) {
    return documentList;
  }

  return documentList.filter((document) => getDocumentIdentity(document) !== identity);
};
