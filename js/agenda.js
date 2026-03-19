import {
  addCourse,
  addTask,
  deleteCourse,
  deleteTask,
  getCourseById,
  getCourses,
  openDB,
  updateCourse,
  updateTask,
} from './db.js';

const courseForm = document.getElementById('courseForm');
const coursesContainer = document.getElementById('coursesContainer');
const courseTemplate = document.getElementById('courseTemplate');
const logoutBtn = document.getElementById('logoutBtn');
const escuelasList = document.getElementById('escuelasList');

const expandedCourses = new Set();
const STATUS_OPTIONS = ['pendiente', 'en proceso', 'finalizada'];
const SCHOOL_COLORS = [
  '#0f766e',
  '#1d4ed8',
  '#b45309',
  '#be123c',
  '#7c3aed',
  '#15803d',
  '#0e7490',
  '#a16207',
];
const EDIT_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-1.79z"/></svg>';
const DELETE_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2h4v2H4V6h4l1-2z"/></svg>';

function statusClass(status) {
  return status.replace(/\s+/g, '-');
}

function schoolColor(escuela) {
  const source = (escuela || '').toLowerCase();
  let hash = 0;

  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }

  return SCHOOL_COLORS[Math.abs(hash) % SCHOOL_COLORS.length];
}

function updateSchoolSuggestions(courses) {
  if (!escuelasList) {
    return;
  }

  const seen = new Set();
  const schools = [];

  courses.forEach((course) => {
    const value = (course.escuela || '').trim();
    if (!value) {
      return;
    }

    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      schools.push(value);
    }
  });

  schools.sort((a, b) => a.localeCompare(b, 'es'));
  escuelasList.innerHTML = '';

  schools.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    escuelasList.appendChild(option);
  });
}

function ensureSession() {
  const raw = sessionStorage.getItem('agendaUser');
  if (!raw) {
    window.location.href = 'index.html';
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    sessionStorage.removeItem('agendaUser');
    window.location.href = 'index.html';
    return null;
  }
}

function buildTaskItem(courseId, task) {
  const li = document.createElement('li');
  li.className = `task-item status-${statusClass(task.status || 'pendiente')}`;
  li.dataset.taskId = String(task.id);

  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;

  const select = document.createElement('select');
  select.className = 'task-status';
  select.dataset.courseId = String(courseId);
  select.dataset.taskId = String(task.id);

  STATUS_OPTIONS.forEach((option) => {
    const el = document.createElement('option');
    el.value = option;
    el.textContent = option;
    el.selected = option === task.status;
    select.appendChild(el);
  });

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'icon-btn edit-task';
  editBtn.title = 'Editar tarea';
  editBtn.ariaLabel = 'Editar tarea';
  editBtn.innerHTML = EDIT_ICON_SVG;

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'icon-btn delete-task';
  deleteBtn.title = 'Eliminar tarea';
  deleteBtn.ariaLabel = 'Eliminar tarea';
  deleteBtn.innerHTML = DELETE_ICON_SVG;

  actions.append(editBtn, deleteBtn);
  li.append(text, select, actions);

  return li;
}

async function renderCourses() {
  const courses = await getCourses();
  coursesContainer.innerHTML = '';
  updateSchoolSuggestions(courses);

  if (!courses.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Todavia no hay cursos. Agrega el primero arriba.';
    coursesContainer.appendChild(empty);
    return;
  }

  courses.forEach((course) => {
    const fragment = courseTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.course-card');
    card.dataset.courseId = String(course.id);
    card.style.setProperty('--school-color', schoolColor(course.escuela));

    fragment.querySelector('.escuela').textContent = course.escuela;
    fragment.querySelector('.course-title').textContent = course.curso;
    fragment.querySelector('.materia').textContent = `Materia: ${course.materia}`;

    const toggleBtn = fragment.querySelector('.toggle-panel');
    const panel = fragment.querySelector('.tasks-panel');
    const list = fragment.querySelector('.tasks-list');

    const isExpanded = expandedCourses.has(course.id);
    panel.classList.toggle('hidden', !isExpanded);
    toggleBtn.textContent = isExpanded ? 'Ocultar' : 'Mostrar';

    const tasks = Array.isArray(course.tasks) ? course.tasks : [];
    if (!tasks.length) {
      const emptyTask = document.createElement('li');
      emptyTask.className = 'empty';
      emptyTask.textContent = 'Sin pendientes por ahora.';
      list.appendChild(emptyTask);
    } else {
      tasks.forEach((task) => list.appendChild(buildTaskItem(course.id, task)));
    }

    coursesContainer.appendChild(fragment);
  });
}

async function onCourseSubmit(event) {
  event.preventDefault();

  const escuela = courseForm.escuela.value.trim();
  const curso = courseForm.curso.value.trim();
  const materia = courseForm.materia.value.trim();

  if (!escuela || !curso || !materia) {
    return;
  }

  const newId = await addCourse({ escuela, curso, materia });
  expandedCourses.add(Number(newId));
  courseForm.reset();
  await renderCourses();
}

async function onTaskSubmit(event) {
  const form = event.target.closest('.task-form');
  if (!form) {
    return;
  }

  event.preventDefault();

  const card = form.closest('.course-card');
  if (!card) {
    return;
  }

  const courseId = Number(card.dataset.courseId);
  const input = form.querySelector('.task-input');
  const text = input.value.trim();

  if (!text) {
    return;
  }

  await addTask(courseId, text);
  input.value = '';
  expandedCourses.add(courseId);
  await renderCourses();
}

async function onStatusChange(event) {
  const select = event.target.closest('.task-status');
  if (!select) {
    return;
  }

  const courseId = Number(select.dataset.courseId);
  const taskId = Number(select.dataset.taskId);
  const status = select.value;

  await updateTask(courseId, taskId, { status });
  expandedCourses.add(courseId);
  await renderCourses();
}

async function onCourseEdit(courseId) {
  const course = await getCourseById(courseId);
  if (!course) {
    return;
  }

  const escuela = window.prompt('Escuela', course.escuela);
  if (escuela === null) {
    return;
  }

  const curso = window.prompt('Curso', course.curso);
  if (curso === null) {
    return;
  }

  const materia = window.prompt('Materia', course.materia);
  if (materia === null) {
    return;
  }

  course.escuela = escuela.trim() || course.escuela;
  course.curso = curso.trim() || course.curso;
  course.materia = materia.trim() || course.materia;

  await updateCourse(course);
  expandedCourses.add(courseId);
  await renderCourses();
}

async function onTaskEdit(courseId, taskId) {
  const course = await getCourseById(courseId);
  if (!course || !Array.isArray(course.tasks)) {
    return;
  }

  const task = course.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  const nextText = window.prompt('Editar tarea', task.text);
  if (nextText === null) {
    return;
  }

  const cleaned = nextText.trim();
  if (!cleaned) {
    return;
  }

  await updateTask(courseId, taskId, { text: cleaned });
  expandedCourses.add(courseId);
  await renderCourses();
}

async function onCourseDelete(courseId) {
  if (!window.confirm('Eliminar este curso y sus tareas?')) {
    return;
  }

  await deleteCourse(courseId);
  expandedCourses.delete(courseId);
  await renderCourses();
}

async function onTaskDelete(courseId, taskId) {
  if (!window.confirm('Eliminar esta tarea?')) {
    return;
  }

  await deleteTask(courseId, taskId);
  expandedCourses.add(courseId);
  await renderCourses();
}

async function onCoursesClick(event) {
  const button = event.target.closest('button');
  if (!button) {
    return;
  }

  const card = button.closest('.course-card');
  if (!card) {
    return;
  }

  const courseId = Number(card.dataset.courseId);

  if (button.classList.contains('toggle-panel')) {
    if (expandedCourses.has(courseId)) {
      expandedCourses.delete(courseId);
    } else {
      expandedCourses.add(courseId);
    }
    await renderCourses();
    return;
  }

  if (button.classList.contains('edit-course')) {
    await onCourseEdit(courseId);
    return;
  }

  if (button.classList.contains('delete-course')) {
    await onCourseDelete(courseId);
    return;
  }

  const taskItem = button.closest('.task-item');
  if (!taskItem) {
    return;
  }

  const taskId = Number(taskItem.dataset.taskId);

  if (button.classList.contains('edit-task')) {
    await onTaskEdit(courseId, taskId);
    return;
  }

  if (button.classList.contains('delete-task')) {
    await onTaskDelete(courseId, taskId);
  }
}

function onLogout() {
  sessionStorage.removeItem('agendaUser');
  window.location.href = 'index.html';
}

async function boot() {
  const user = ensureSession();
  if (!user) {
    return;
  }

  await openDB();
  courseForm.addEventListener('submit', onCourseSubmit);
  coursesContainer.addEventListener('click', (event) => {
    onCoursesClick(event).catch((error) => console.error(error));
  });
  coursesContainer.addEventListener('submit', (event) => {
    onTaskSubmit(event).catch((error) => console.error(error));
  });
  coursesContainer.addEventListener('change', (event) => {
    onStatusChange(event).catch((error) => console.error(error));
  });
  logoutBtn.addEventListener('click', onLogout);

  await renderCourses();
}

boot().catch((error) => {
  console.error('Error al iniciar agenda:', error);
  window.alert('No se pudo iniciar la agenda. Revisa la consola.');
});
