const DB_NAME = 'agendaDocenteDB';
const DB_VERSION = 1;
let dbPromise;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function ensureDefaultUser(db) {
  const tx = db.transaction('users', 'readwrite');
  const users = tx.objectStore('users');
  const index = users.index('username');
  const current = await requestToPromise(index.get('admin'));

  if (!current) {
    users.add({
      username: 'admin',
      password: '123456',
      displayName: 'Admin',
      createdAt: Date.now(),
    });
  }

  await transactionDone(tx);
}

export async function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('users')) {
          const users = db.createObjectStore('users', {
            keyPath: 'id',
            autoIncrement: true,
          });
          users.createIndex('username', 'username', { unique: true });
        }

        if (!db.objectStoreNames.contains('courses')) {
          db.createObjectStore('courses', {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      };

      request.onsuccess = async () => {
        const db = request.result;
        db.onversionchange = () => db.close();

        try {
          await ensureDefaultUser(db);
          resolve(db);
        } catch (error) {
          reject(error);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

export async function validateCredentials(username, password) {
  const db = await openDB();
  const tx = db.transaction('users', 'readonly');
  const users = tx.objectStore('users');
  const index = users.index('username');
  const user = await requestToPromise(index.get(username));
  await transactionDone(tx);

  if (!user || user.password !== password) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
  };
}

export async function getCourses() {
  const db = await openDB();
  const tx = db.transaction('courses', 'readonly');
  const courses = tx.objectStore('courses');
  const all = await requestToPromise(courses.getAll());
  await transactionDone(tx);
  return all.sort((a, b) => b.id - a.id);
}

export async function getCourseById(courseId) {
  const db = await openDB();
  const tx = db.transaction('courses', 'readonly');
  const store = tx.objectStore('courses');
  const course = await requestToPromise(store.get(Number(courseId)));
  await transactionDone(tx);
  return course;
}

export async function addCourse({ escuela, curso, materia }) {
  const db = await openDB();
  const tx = db.transaction('courses', 'readwrite');
  const store = tx.objectStore('courses');
  const id = await requestToPromise(
    store.add({
      escuela,
      curso,
      materia,
      tasks: [],
      createdAt: Date.now(),
    })
  );
  await transactionDone(tx);
  return id;
}

export async function updateCourse(course) {
  const db = await openDB();
  const tx = db.transaction('courses', 'readwrite');
  const store = tx.objectStore('courses');
  store.put(course);
  await transactionDone(tx);
}

export async function deleteCourse(courseId) {
  const db = await openDB();
  const tx = db.transaction('courses', 'readwrite');
  const store = tx.objectStore('courses');
  store.delete(Number(courseId));
  await transactionDone(tx);
}

export async function addTask(courseId, text) {
  const course = await getCourseById(courseId);
  if (!course) {
    return;
  }

  if (!Array.isArray(course.tasks)) {
    course.tasks = [];
  }

  course.tasks.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    text,
    status: 'pendiente',
    createdAt: Date.now(),
  });

  await updateCourse(course);
}

export async function updateTask(courseId, taskId, updates) {
  const course = await getCourseById(courseId);
  if (!course || !Array.isArray(course.tasks)) {
    return;
  }

  const index = course.tasks.findIndex((task) => task.id === Number(taskId));
  if (index === -1) {
    return;
  }

  course.tasks[index] = {
    ...course.tasks[index],
    ...updates,
  };

  await updateCourse(course);
}

export async function deleteTask(courseId, taskId) {
  const course = await getCourseById(courseId);
  if (!course || !Array.isArray(course.tasks)) {
    return;
  }

  course.tasks = course.tasks.filter((task) => task.id !== Number(taskId));
  await updateCourse(course);
}
