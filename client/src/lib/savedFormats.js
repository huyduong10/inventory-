const STORAGE_KEY = 'inventory_saved_formats';

export const getSavedFormats = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

export const persistSavedFormats = (formats) => {
  if (typeof window === 'undefined') return formats;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formats));
  } catch (_error) {
    // Ignore localStorage write errors.
  }

  return formats;
};

export const clearSavedFormats = () => {
  if (typeof window === 'undefined') return [];
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    // Ignore localStorage write errors.
  }
  return [];
};

export const upsertSavedFormat = ({ id, type, name, data }) => {
  const formatName = (name || '').trim() || 'Format mới';
  const formats = getSavedFormats();
  const nextFormats = id
    ? formats.filter((format) => format.id !== id)
    : formats.filter((format) => !(format.type === type && format.name === formatName));

  const savedFormat = {
    id: id || `format-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    name: formatName,
    data,
    updatedAt: new Date().toISOString(),
  };

  const updatedFormats = [savedFormat, ...nextFormats].sort((a, b) =>
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  return persistSavedFormats(updatedFormats);
};

export const deleteSavedFormat = (id) => {
  const formats = getSavedFormats().filter((format) => format.id !== id);
  return persistSavedFormats(formats);
};
