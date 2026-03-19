async function loadSharedFooter() {
  const hosts = document.querySelectorAll('[data-shared-footer]');
  if (!hosts.length) {
    return;
  }

  const footerUrl = new URL('../footer/footer.html', import.meta.url);
  let html = '';

  try {
    const response = await fetch(footerUrl);
    if (!response.ok) {
      throw new Error(`No se pudo cargar footer: ${response.status}`);
    }
    html = await response.text();
  } catch (error) {
    console.error(error);
    html = `
      <footer class="app-footer">
        <div class="footer-inner">
          <p class="footer-brand">agendaDocente</p>
          <nav class="footer-nav" aria-label="Navegacion secundaria">
            <a href="configuracion.html">Configuracion</a>
          </nav>
        </div>
      </footer>
    `;
  }

  hosts.forEach((host) => {
    host.innerHTML = html;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadSharedFooter().catch((error) => console.error(error));
  });
} else {
  loadSharedFooter().catch((error) => console.error(error));
}
