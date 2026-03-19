import { openDB, validateCredentials } from './db.js';

const loginForm = document.getElementById('loginForm');
const message = document.getElementById('loginMessage');

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

async function boot() {
  await openDB();

  const activeUser = sessionStorage.getItem('agendaUser');
  if (activeUser) {
    window.location.href = 'agenda.html';
    return;
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = loginForm.username.value.trim();
    const password = loginForm.password.value.trim();

    if (!username || !password) {
      setMessage('Completa usuario y contrasena.', 'error');
      return;
    }

    setMessage('Validando...', '');

    try {
      const user = await validateCredentials(username, password);
      if (!user) {
        setMessage('Credenciales invalidas.', 'error');
        return;
      }

      sessionStorage.setItem('agendaUser', JSON.stringify(user));
      setMessage('Ingreso correcto. Redirigiendo...', 'success');
      window.location.href = 'agenda.html';
    } catch (error) {
      setMessage('Error al validar credenciales.', 'error');
      console.error(error);
    }
  });
}

boot().catch((error) => {
  setMessage('No se pudo iniciar la app.', 'error');
  console.error(error);
});
