const STORAGE_KEY = 'agendaSchoolColors';

export const DEFAULT_SCHOOL_COLORS = [
  '#0f766e',
  '#1d4ed8',
  '#b45309',
  '#be123c',
  '#7c3aed',
  '#15803d',
  '#0e7490',
  '#a16207',
];

export function normalizeSchoolName(name) {
  return (name || '').trim().toLowerCase();
}

function canUseStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch (error) {
    return false;
  }
}

function isValidHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function getSchoolColorMap() {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('No se pudo leer agendaSchoolColors:', error);
    return {};
  }
}

function writeSchoolColorMap(map) {
  if (!canUseStorage()) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getSchoolColor(name) {
  const key = normalizeSchoolName(name);
  if (!key) {
    return null;
  }

  const map = getSchoolColorMap();
  const color = map[key];
  return isValidHexColor(color) ? color : null;
}

export function setSchoolColor(name, color) {
  const key = normalizeSchoolName(name);
  if (!key || !isValidHexColor(color)) {
    return false;
  }

  const map = getSchoolColorMap();
  map[key] = color;
  writeSchoolColorMap(map);
  return true;
}

export function removeSchoolColor(name) {
  const key = normalizeSchoolName(name);
  if (!key) {
    return false;
  }

  const map = getSchoolColorMap();
  if (!map[key]) {
    return false;
  }

  delete map[key];
  writeSchoolColorMap(map);
  return true;
}

export function computeFallbackSchoolColor(name) {
  const source = normalizeSchoolName(name);
  if (!source) {
    return DEFAULT_SCHOOL_COLORS[0];
  }

  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }

  return DEFAULT_SCHOOL_COLORS[Math.abs(hash) % DEFAULT_SCHOOL_COLORS.length];
}
