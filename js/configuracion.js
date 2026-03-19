import { getCourses, openDB } from './db.js';
import {
  computeFallbackSchoolColor,
  getSchoolColor,
  getSchoolColorMap,
  normalizeSchoolName,
  removeSchoolColor,
  setSchoolColor,
} from './settings.js';

const schoolColorForm = document.getElementById('schoolColorForm');
const configEscuela = document.getElementById('configEscuela');
const configEscuelasList = document.getElementById('configEscuelasList');
const configColor = document.getElementById('configColor');
const removeColorBtn = document.getElementById('removeColorBtn');
const configMessage = document.getElementById('configMessage');
const colorList = document.getElementById('colorList');

function ensureSession() {
  const raw = sessionStorage.getItem('agendaUser');
  if (!raw) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function setMessage(text, type = '') {
  configMessage.textContent = text;
  configMessage.className = `message ${type}`.trim();
}

function getSchoolCatalog(courses) {
  const byKey = new Map();

  courses.forEach((course) => {
    const value = (course.escuela || '').trim();
    const key = normalizeSchoolName(value);
    if (key && !byKey.has(key)) {
      byKey.set(key, value);
    }
  });

  return byKey;
}

function renderSchoolSuggestions(catalog, customMap) {
  const schools = new Set();

  Array.from(catalog.values()).forEach((name) => schools.add(name));
  Object.keys(customMap).forEach((key) => {
    if (!schools.has(key)) {
      schools.add(key);
    }
  });

  const ordered = Array.from(schools).sort((a, b) => a.localeCompare(b, 'es'));
  configEscuelasList.innerHTML = '';

  ordered.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    configEscuelasList.appendChild(option);
  });
}

function renderColorList(catalog, customMap) {
  colorList.innerHTML = '';

  const schoolKeys = new Set([...Object.keys(customMap), ...Array.from(catalog.keys())]);
  if (!schoolKeys.size) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No hay escuelas cargadas todavia.';
    colorList.appendChild(li);
    return;
  }

  const orderedKeys = Array.from(schoolKeys).sort((a, b) => a.localeCompare(b, 'es'));

  orderedKeys.forEach((key) => {
    const displayName = catalog.get(key) || key;
    const custom = customMap[key];
    const color = custom || computeFallbackSchoolColor(displayName);

    const li = document.createElement('li');
    li.className = 'color-item';

    const swatch = document.createElement('span');
    swatch.className = 'color-swatch';
    swatch.style.background = color;

    const text = document.createElement('span');
    text.className = 'color-name';
    text.textContent = displayName;

    const mode = document.createElement('span');
    mode.className = `color-mode ${custom ? 'custom' : 'default'}`;
    mode.textContent = custom ? 'Personalizado' : 'Automatico';

    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'secondary use-color';
    useBtn.dataset.school = displayName;
    useBtn.dataset.color = color;
    useBtn.textContent = 'Editar';

    li.append(swatch, text, mode, useBtn);
    colorList.appendChild(li);
  });
}

function loadSelectedSchoolColor() {
  const school = configEscuela.value.trim();
  if (!school) {
    configColor.value = '#0f766e';
    return;
  }

  const customColor = getSchoolColor(school);
  configColor.value = customColor || computeFallbackSchoolColor(school);
}

async function render() {
  const courses = await getCourses();
  const catalog = getSchoolCatalog(courses);
  const customMap = getSchoolColorMap();

  renderSchoolSuggestions(catalog, customMap);
  renderColorList(catalog, customMap);
}

async function onSaveColor(event) {
  event.preventDefault();

  const school = configEscuela.value.trim();
  const color = configColor.value;

  if (!school) {
    setMessage('Ingresa una escuela para guardar el color.', 'error');
    return;
  }

  if (!setSchoolColor(school, color)) {
    setMessage('No se pudo guardar el color.', 'error');
    return;
  }

  setMessage('Color guardado correctamente.', 'success');
  await render();
}

async function onRemoveColor() {
  const school = configEscuela.value.trim();
  if (!school) {
    setMessage('Ingresa una escuela para quitar color.', 'error');
    return;
  }

  const removed = removeSchoolColor(school);
  if (!removed) {
    setMessage('No habia un color personalizado para esa escuela.', 'error');
    return;
  }

  setMessage('Color personalizado eliminado.', 'success');
  configColor.value = computeFallbackSchoolColor(school);
  await render();
}

function onListClick(event) {
  const button = event.target.closest('.use-color');
  if (!button) {
    return;
  }

  const school = button.dataset.school || '';
  const color = button.dataset.color || '#0f766e';
  configEscuela.value = school;
  configColor.value = color;
  setMessage('Escuela lista para editar.', '');
}

async function boot() {
  if (!ensureSession()) {
    return;
  }

  await openDB();
  await render();
  loadSelectedSchoolColor();

  schoolColorForm.addEventListener('submit', (event) => {
    onSaveColor(event).catch((error) => {
      console.error(error);
      setMessage('Error al guardar configuracion.', 'error');
    });
  });

  removeColorBtn.addEventListener('click', () => {
    onRemoveColor().catch((error) => {
      console.error(error);
      setMessage('Error al quitar color.', 'error');
    });
  });

  configEscuela.addEventListener('change', loadSelectedSchoolColor);
  configEscuela.addEventListener('blur', loadSelectedSchoolColor);
  colorList.addEventListener('click', onListClick);
}

boot().catch((error) => {
  console.error(error);
  setMessage('No se pudo cargar configuracion.', 'error');
});
