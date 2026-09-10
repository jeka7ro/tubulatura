// ====================================================================
// KRONVENT BRAȘOV - ADMIN BACKOFFICE LOGIC (admin.js)
// ====================================================================

const adminState = {
  items: [],
  sheets_v2: {},
  currentSheet: 'Comanda',
  meta: {},
  settings: {
    pretMpRectangular: 15.0,
    cursEur: 5.2542,
    cursBnrDate: '09.09.2026',
    tva: 21,
    flansaPerimeterThreshold: 3500,
    dimGrosimePrag1: 500,
    dimGrosimePrag2: 1000,
    density06: 4.71,
    density08: 6.28,
    density10: 7.85,
    clipsStep: 350,
    siliconStep: 18
  },
  yearsData: {
    activeYear: 2026,
    years: [],
    orders: [],
    spiroPrices: {}
  },
  filters: {
    search: '',
    category: 'all'
  }
};

// Preluare Curs Oficial BNR pentru Backoffice
async function fetchBnrForAdmin() {
  try {
    const res = await fetch('/api/bnr');
    if (res.ok) {
      const data = await res.json();
      if (data && data.rate) {
        adminState.settings.cursEur = data.rate;
        adminState.settings.cursBnrDate = data.date || '09.09.2026';

        const dateEl = document.getElementById('admin-bnr-date');
        const numEl = document.getElementById('admin-bnr-num');
        if (dateEl) dateEl.textContent = adminState.settings.cursBnrDate;
        if (numEl) numEl.textContent = `${data.rate.toFixed(4)} RON`;

        const inputCurs = document.getElementById('admin-setting-curs-eur');
        if (inputCurs) inputCurs.value = data.rate.toFixed(4);

        const statusEl = document.getElementById('admin-bnr-sync-status');
        if (statusEl) statusEl.textContent = `Sincronizat cu BNR: 1 EUR = ${data.rate.toFixed(4)} RON la data ${adminState.settings.cursBnrDate}`;
        console.log(`[BNR ADMIN] Curs actualizat: 1 EUR = ${data.rate} RON (${adminState.settings.cursBnrDate})`);
        if (typeof updateAdminMetrics === 'function') updateAdminMetrics();
        if (typeof renderAdminTable === 'function') renderAdminTable();
      }
    }
  } catch (err) {
    console.warn('Nu s-a putut prelua cursul BNR în admin:', err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try { setupThemeToggle(); } catch (e) { console.error('setupThemeToggle err:', e); }
  try { setupLogout(); } catch (e) { console.error('setupLogout err:', e); }
  try { setupAdminTabs(); } catch (e) { console.error('setupAdminTabs err:', e); }
  try { setupDashboard(); } catch (e) { console.error('setupDashboard err:', e); }
  try { setupAdminListeners(); } catch (e) { console.error('setupAdminListeners err:', e); }
  try { setupYearListeners(); } catch (e) { console.error('setupYearListeners err:', e); }
  try { await loadAdminData(); } catch (e) { console.error('loadAdminData err:', e); }
  try { await loadYearsAndParameters(); } catch (e) { console.error('loadYearsAndParameters err:', e); }
  try { await fetchBnrForAdmin(); } catch (e) { console.error('fetchBnrForAdmin err:', e); }
  try { setupRealtimeOrderListener(); } catch (e) { console.error('setupRealtimeOrderListener err:', e); }
});

function setupRealtimeOrderListener() {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const syncChannel = new BroadcastChannel('kronvent_sync');
      syncChannel.onmessage = async (e) => {
        if (e.data && e.data.type === 'NEW_ORDER') {
          console.log('[ADMIN SYNC] Comandă nouă primită de la client!');
          await loadYearsAndParameters();
          const ord = e.data.order;
          showToast(`Comandă nouă înregistrată: ${ord?.id || ''} de la ${ord?.client || 'Client'}!`, 'success');
        }
      };
    } catch (e) {
      console.warn('Eroare BroadcastChannel în admin:', e);
    }
  }
}

// Setup Light/Dark Theme Toggle (Default is macOS Light, Icon-Only)
function setupThemeToggle() {
  const btnToggle = document.getElementById('btn-theme-toggle');
  if (!btnToggle) return;

  const savedTheme = localStorage.getItem('kronvent_theme') || 'light';
  applyTheme(savedTheme);

  btnToggle.addEventListener('click', () => {
    const isCurrentDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isCurrentDark ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('kronvent_theme', newTheme);
  });

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      btnToggle.innerHTML = `<svg class="icon-svg icon-theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
      btnToggle.setAttribute('title', 'Comută la Mod Luminos');
    } else {
      document.documentElement.removeAttribute('data-theme');
      btnToggle.innerHTML = `<svg class="icon-svg icon-theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      btnToggle.setAttribute('title', 'Comută la Mod Întunecat');
    }
  }
}

// Setup Admin Logout Handler
function setupLogout() {
  const btnLogout = document.getElementById('btn-logout');
  if (!btnLogout) return;

  btnLogout.addEventListener('click', () => {
    showAppConfirm(
      'Confirmare Delogare Administrator',
      'Sunteți sigur că doriți să vă delogați din contul de administrator (Ing. Adrian Popa)?',
      () => {
        localStorage.removeItem('kronvent_admin_session');
        showToast('Ați fost delogat cu succes. Redirecționare spre portal...', 'info');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 600);
      },
      null,
      'Delogare',
      'Anulează',
      true
    );
  });
}

function setupAdminTabs() {
  const tabTitles = {
    'admin-tab-dashboard': {
      title: 'Vânzări & Dashboard Executiv',
      subtitle: 'Sinteză comenzi clienți B2B • Anul de Fabricație 2026'
    },
    'admin-tab-comenzi': {
      title: 'Centralizator Tehnic & Nomenclator Fabricație',
      subtitle: 'Calcul dinamic nativ de producție (SR EN 1505 / 1506) fără dependențe externe'
    },
    'admin-tab-materiale': {
      title: 'Necesar Materiale Atelier',
      subtitle: 'Debitări tablă zincată, flanșe, colțare și consumabile'
    },
    'admin-tab-setari': {
      title: 'Setări Comerciale & Curs BNR',
      subtitle: 'Prețuri de bază tablă/mp, coeficienți tehnici și sincronizare valutară'
    },
    'admin-tab-ani': {
      title: 'Versionare pe Ani & Imuabilitate',
      subtitle: 'Snapshot-uri anuale securizate, arhivă comenzi și parametri de producție'
    }
  };

  const tabs = document.querySelectorAll('.admin-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add('active');

      const meta = tabTitles[targetId];
      if (meta) {
        const titleEl = document.getElementById('admin-page-title');
        const subEl = document.getElementById('admin-page-subtitle');
        if (titleEl) titleEl.textContent = meta.title;
        if (subEl) subEl.textContent = meta.subtitle;
      }

      if (targetId === 'admin-tab-dashboard' && typeof renderAdminDashboard === 'function') {
        renderAdminDashboard();
      }
    });
  });
}

async function loadAdminData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Nu s-au putut încărca datele');
    const data = await res.json();
    adminState.meta = data.meta || {};
    adminState.items = (data.items || []).map((it, idx) => enrichAdminItem(it, idx + 1));
    adminState.sheets_v2 = data.sheets_v2 || {};

    renderExcelSheetTabs();
    updateAdminMetrics();
    updateAdminAtelierBreakdown();
    renderActiveSheetTable();
  } catch (e) {
    console.error('Error loading admin data:', e);
  }
}

function enrichAdminItem(it, nr) {
  const isMounting = it.categorie === 'Materiale montaj';
  let flansa = it.flansa || '';
  let grosime = it.grosime || '';

  if (isMounting) {
    flansa = '-';
    grosime = '-';
  } else {
    if (!flansa && it.dimensiuni) {
      const nums = it.dimensiuni.match(/\d+/g);
      if (nums && nums.length >= 2) {
        const a = parseInt(nums[0], 10) || 0;
        const b = parseInt(nums[1], 10) || 0;
        flansa = (a + b) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      } else {
        flansa = 'FLANSA20';
      }
    }

    if (!grosime && it.dimensiuni) {
      const nums = it.dimensiuni.match(/\d+/g);
      if (nums && nums.length >= 2) {
        const a = parseInt(nums[0], 10) || 0;
        const b = parseInt(nums[1], 10) || 0;
        const maxDim = Math.max(a, b);
        grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      } else {
        grosime = '0.8';
      }
    }
  }

  const sTot = parseFloat(it.suprafata) || 0;
  const cant = parseFloat(it.cantitate) || 1;
  const sUnit = cant > 0 ? (sTot / cant) : 0;
  const coltari = isMounting ? 0 : (it.coltari !== undefined ? it.coltari : (it.cod === 'Capac' || it.cod === 'YAKA' ? cant * 4 : cant * 8));
  const density = grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85);
  const greutate = isMounting ? 0 : (it.greutate !== undefined ? it.greutate : parseFloat((sTot * density).toFixed(2)));

  let valoareTotala = it.valoareTotala;
  let pretUnitar = it.pretUnitar;

  if (valoareTotala === undefined) {
    if (isMounting) {
      pretUnitar = 0.5;
      valoareTotala = cant * pretUnitar;
    } else {
      pretUnitar = sUnit * adminState.settings.pretMpRectangular;
      valoareTotala = sTot * adminState.settings.pretMpRectangular;
    }
  }

  const eticheta = it.eticheta || (isMounting ? it.dimensiuni : '-');

  return {
    ...it,
    nr: nr || it.nr,
    eticheta,
    flansa,
    grosime: isMounting ? '-' : (grosime ? grosime.toString().replace(',', '.') : '0.8'),
    sUnit: parseFloat(sUnit.toFixed(4)),
    suprafata: parseFloat(sTot.toFixed(4)),
    pretUnitar: parseFloat((pretUnitar || 0).toFixed(2)),
    valoareTotala: parseFloat((valoareTotala || 0).toFixed(2)),
    coltari: Math.round(coltari),
    greutate
  };
}

function updateAdminMetrics() {
  let totValEur = 0;
  let totSup = 0;
  let totPieces = 0;
  let totGreut = 0;

  adminState.items.forEach(it => {
    totValEur += parseFloat(it.valoareTotala) || 0;
    totSup += parseFloat(it.suprafata) || 0;
    totPieces += parseFloat(it.cantitate) || 0;
    totGreut += parseFloat(it.greutate) || 0;
  });

  const totValRon = totValEur * adminState.settings.cursEur;

  document.getElementById('admin-kpi-valoare').textContent = `${totValEur.toFixed(2)} €`;
  document.getElementById('admin-kpi-ron').textContent = `${totValRon.toFixed(2)} RON (fără TVA)`;
  document.getElementById('admin-kpi-suprafata').textContent = `${totSup.toFixed(2)} m²`;
  document.getElementById('admin-kpi-piese').textContent = `${Math.round(totPieces)} bucăți`;
  document.getElementById('admin-kpi-pozitii').textContent = `${adminState.items.length} poziții în lucru`;
  document.getElementById('admin-kpi-greutate').textContent = `${totGreut.toFixed(1)} kg`;
  document.getElementById('admin-items-count-badge').textContent = adminState.items.length;
}

function updateAdminAtelierBreakdown() {
  let t06 = { s: 0, w: 0 };
  let t08 = { s: 0, w: 0 };
  let t10 = { s: 0, w: 0 };
  let flansa20 = 0;
  let flansa30 = 0;
  let coltari20 = 0;
  let coltari30 = 0;

  adminState.items.forEach(it => {
    const s = parseFloat(it.suprafata) || 0;
    const g = it.grosime ? it.grosime.toString().trim() : '0.8';
    const c = it.coltari || 0;

    if (g === '0.6') {
      t06.s += s;
      t06.w += s * 4.71;
    } else if (g === '1.0' || g === '1') {
      t10.s += s;
      t10.w += s * 7.85;
    } else {
      t08.s += s;
      t08.w += s * 6.28;
    }

    if (it.dimensiuni && it.categorie !== 'Tubulatura Circulara Spiro' && it.categorie !== 'Materiale montaj') {
      const nums = it.dimensiuni.match(/\d+/g);
      if (nums && nums.length >= 2) {
        const a = parseInt(nums[0], 10) || 0;
        const b = parseInt(nums[1], 10) || 0;
        const cant = it.cantitate || 1;
        const ml = ((a + b) * 4 / 1000) * cant;
        if (it.flansa === 'FLANSA30') {
          flansa30 += ml;
          coltari30 += c;
        } else {
          flansa20 += ml;
          coltari20 += c;
        }
      }
    }
  });

  const garnitura = (flansa20 + flansa30) / 2;

  const setT = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setT('mat-tabla-06', `${t06.s.toFixed(2)} m² (${t06.w.toFixed(1)} kg)`);
  setT('mat-tabla-08', `${t08.s.toFixed(2)} m² (${t08.w.toFixed(1)} kg)`);
  setT('mat-tabla-10', `${t10.s.toFixed(2)} m² (${t10.w.toFixed(1)} kg)`);
  setT('mat-flansa-20', `${flansa20.toFixed(1)} ml (~${Math.ceil(flansa20 / 5)} bare x 5m)`);
  setT('mat-flansa-30', `${flansa30.toFixed(1)} ml (~${Math.ceil(flansa30 / 5)} bare x 5m)`);
  setT('mat-coltari-20', `${coltari20} buc`);
  setT('mat-coltari-30', `${coltari30} buc`);
  setT('mat-gasket', `${garnitura.toFixed(1)} ml (~${Math.ceil(garnitura / 10)} role x 10m)`);
}

const CATEGORIES_OPTIONS = [
  'Canal drept',
  'Cot rectangular ( fara dirijori )',
  'Cot rectangular drept',
  'Cot rectangular cu dirijori',
  'Teu',
  'Piesa de deviatie (etaj)',
  'Reductie simetrica/asimetrica',
  'Capac',
  'YAKA',
  'Ramif. bilaterala (2 coturi)',
  'Ramif. laterala(cot+canal)',
  'Ramif. pantalon',
  'Schimbare sec.concentrica',
  'Schimbare sec.excentrica',
  'Plenum',
  'Tubulatura Circulara Spiro',
  'Materiale montaj'
];

// ====================================================================
// EXCEL MULTI-SHEET WORKBOOK NAVIGATION & EDITING ENGINE
// ====================================================================

function renderExcelSheetTabs() {
  const container = document.getElementById('admin-sheet-tabs-container');
  if (!container) return;
  container.innerHTML = '';

  // 1. Centralizator Comandă
  const comandaTab = document.createElement('button');
  comandaTab.type = 'button';
  comandaTab.id = 'sheet-tab-comanda';
  comandaTab.className = `excel-sheet-tab ${adminState.currentSheet === 'Comanda' ? 'active' : ''}`;
  comandaTab.innerHTML = `
    <span>📋 Comanda (Centralizator)</span>
    <span class="sheet-badge">${adminState.items.length}</span>
  `;
  comandaTab.addEventListener('click', (e) => {
    e.preventDefault();
    selectSheet('Comanda');
  });
  container.appendChild(comandaTab);

  // 2. Foi de calcul tehnice din Excel
  const sheetNames = Object.keys(adminState.sheets_v2 || {});
  sheetNames.forEach(name => {
    const s = adminState.sheets_v2[name];
    const tab = document.createElement('button');
    tab.type = 'button';
    const cleanId = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    tab.id = `sheet-tab-${cleanId}`;
    tab.className = `excel-sheet-tab ${adminState.currentSheet === name ? 'active' : ''}`;
    const rowCount = s.rows ? s.rows.length : 0;
    tab.innerHTML = `
      <span>${s.sheetName || name}</span>
      <span class="sheet-badge">${rowCount}</span>
    `;
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      selectSheet(name);
    });
    container.appendChild(tab);
  });
}

function selectSheet(name) {
  adminState.currentSheet = name;
  renderExcelSheetTabs();

  const titleEl = document.getElementById('admin-sheet-active-title');
  if (titleEl) {
    if (name === 'Comanda') {
      titleEl.textContent = `Comanda (Centralizator ${adminState.items.length} poziții)`;
    } else {
      const s = adminState.sheets_v2[name];
      titleEl.textContent = `${s ? s.title : name} (${s && s.rows ? s.rows.length : 0} rânduri)`;
    }
  }

  // Toggling Comanda toolbar vs piece sheets
  const toolbar = document.getElementById('admin-comanda-toolbar');
  if (toolbar) {
    toolbar.style.display = name === 'Comanda' ? 'flex' : 'none';
  }

  renderActiveSheetTable();
}

const SHEET_CAD_MAP = {
  'Canal drept': { img: 'assets/icons3d/CRD.png', code: 'CRD', title: 'Canal Drept Rectangular', desc: 'Schiță tehnică CAD extrasă din Excel. Dimensiuni principale: A (Lățime), B (Înălțime), L (Lungime tronson debitat).' },
  'Cot rectangular': { img: 'assets/icons3d/CR.png', code: 'CR', title: 'Cot Rectangular 90° / 45° (fără dirijori)', desc: 'Schiță tehnică CAD extrasă din Excel. Dimensiuni: A1 (Intrare), A2 (Ieșire), B (Înălțime), R (Rază interioară).' },
  'Cot rectangular drept': { img: 'assets/icons3d/CRDr.png', code: 'CRDr', title: 'Cot Rectangular Drept', desc: 'Schiță tehnică CAD extrasă din Excel. Racord drept intrare/ieșire.' },
  'Cot rectangular cu dirijori': { img: 'assets/icons3d/CRDir.png', code: 'CRDir', title: 'Cot Rectangular cu Dirijori Aerodinamici', desc: 'Schiță tehnică CAD extrasă din Excel. Echipat cu paleți/dirijori interiori.' },
  'Teu': { img: 'assets/icons3d/TR.png', code: 'TR', title: 'Teu Rectangular', desc: 'Schiță tehnică CAD extrasă din Excel. Trunchi principal A x B și ramificație C x B.' },
  'Piesa de deviatie (etaj)': { img: 'assets/icons3d/PDE.png', code: 'PDE', title: 'Piesă de Deviație (Etaj / Ocolire)', desc: 'Schiță tehnică CAD extrasă din Excel. Dimensiuni: A, B, L și decalaj/fugă F.' },
  'Reductie simetrica_asim.': { img: 'assets/icons3d/Red.png', code: 'Red', title: 'Reducție Simetrică / Asimetrică', desc: 'Schiță tehnică CAD extrasă din Excel. Dimensiuni: A x B la C x D, cu decalaj orizontal e și vertical f.' },
  'YAKA': { img: 'assets/icons3d/YAKA.png', code: 'YAKA', title: 'Piesă Racord YAKA (Ștuț Ramificație)', desc: 'Schiță tehnică CAD extrasă din Excel. Dimensiuni: A (Lățime racord), B (Înălțime racord), C (Lungime bază canal), L (Înălțime ștuț), G (Talpă/bordură fixare).' },
  'Ramif. bilaterala (2 coturi)': { img: 'assets/icons3d/R2C.png', code: 'R2C', title: 'Ramificație Bilaterală (2 Coturi)', desc: 'Schiță tehnică CAD extrasă din Excel. Două coturi simetrice C1/C2 și D1/D2.' },
  'Ramif. laterala(cot+canal)': { img: 'assets/icons3d/RCC.png', code: 'RCC', title: 'Ramificație Laterală (Cot + Canal)', desc: 'Schiță tehnică CAD extrasă din Excel. Cot lateral D1/D2 grefat pe canal C1/C2.' },
  'Ramif. pantalon': { img: 'assets/icons3d/RP.png', code: 'RP', title: 'Ramificație Pantalon', desc: 'Schiță tehnică CAD extrasă din Excel. Trunchi principal A x B divizat în două brațe C și D cu distanță E.' },
  'Capac': { img: 'assets/icons3d/Capac.png', code: 'Capac', title: 'Capac Rectangular', desc: 'Schiță tehnică CAD extrasă din Excel. Închidere capăt canal secțiune A x B.' },
  'Schimbare sec.concentrica': { img: 'assets/icons3d/SSC.png', code: 'SSC', title: 'Schimbare Secțiune Concentrică (Rectangular - Rotund)', desc: 'Schiță tehnică CAD extrasă din Excel. Trecere de la secțiune A x B la diametru rotund Ød.' },
  'Schimbare sec.excentrica': { img: 'assets/icons3d/SSE.png', code: 'SSE', title: 'Schimbare Secțiune Excentrică (Rectangular - Rotund)', desc: 'Schiță tehnică CAD extrasă din Excel. Trecere excentrică de la A x B la diametru rotund Ød.' },
  'Plenum': { img: 'assets/icons3d/Plenum.png', code: 'Plenum', title: 'Plenum Cutie Difuzor HVAC', desc: 'Schiță tehnică CAD extrasă din Excel. Cască A x B x H cu ștuțuri racord Ød.' }
};

function updateAdminSheetCADBanner(sheetName) {
  const box = document.getElementById('admin-sheet-cad-box');
  if (!box) return;

  const cad = SHEET_CAD_MAP[sheetName];
  if (cad) {
    box.style.display = 'flex';
    const img = document.getElementById('admin-sheet-cad-img');
    const title = document.getElementById('admin-sheet-cad-title');
    const desc = document.getElementById('admin-sheet-cad-desc');
    if (img) {
      img.src = cad.img;
      img.alt = cad.title;
    }
    if (title) title.textContent = `${cad.code} - ${cad.title}`;
    if (desc) desc.textContent = cad.desc;
  } else {
    box.style.display = 'none';
  }
}

function renderActiveSheetTable() {
  updateAdminSheetCADBanner(adminState.currentSheet);

  if (adminState.currentSheet === 'Comanda') {
    const thead = document.getElementById('admin-table-thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th style="width: 36px; text-align: center;">Nr.</th>
          <th style="min-width: 170px;">Denumire / Etichetă</th>
          <th style="min-width: 150px;">Tip / Categorie Piesă</th>
          <th style="width: 70px;">Cod</th>
          <th style="min-width: 150px;">Dimensiuni (mm)</th>
          <th style="width: 80px; text-align: right;">Cant. [buc]</th>
          <th style="width: 85px; text-align: right;">S. Unit [m²]</th>
          <th style="width: 85px; text-align: right;">S. Tot [m²]</th>
          <th style="width: 85px; text-align: right;">Preț Unit [€]</th>
          <th style="width: 95px; text-align: right;">Total [€]</th>
          <th style="width: 110px;">Flanșă</th>
          <th style="width: 85px;">Grosime</th>
          <th style="width: 75px; text-align: center;">Acțiuni</th>
        </tr>
      `;
    }
    renderAdminTable();
    const tfoot = document.getElementById('admin-table-tfoot');
    if (tfoot) tfoot.style.display = '';
  } else {
    renderCustomSheetTable(adminState.currentSheet);
    const tfoot = document.getElementById('admin-table-tfoot');
    if (tfoot) tfoot.style.display = 'none';
  }
}

function renderCustomSheetTable(sheetName) {
  const s = adminState.sheets_v2[sheetName];
  if (!s) return;

  const thead = document.getElementById('admin-table-thead');
  const tbody = document.getElementById('admin-items-tbody');
  if (!thead || !tbody) return;

  // Build thead
  let headHtml = '<tr>';
  (s.headers || []).forEach(h => {
    headHtml += `<th style="white-space: nowrap; font-size: 11px;">${h}</th>`;
  });
  headHtml += '<th style="width: 70px; text-align: center;">Acțiuni</th></tr>';
  thead.innerHTML = headHtml;

  // Build tbody
  tbody.innerHTML = '';
  (s.rows || []).forEach((row, rowIdx) => {
    const tr = document.createElement('tr');
    tr.id = `sheet-row-${rowIdx}`;
    let rowHtml = '';

    (s.fields || []).forEach(field => {
      const val = row[field] !== undefined ? row[field] : '';
      const isNum = ['A', 'B', 'C', 'D', 'E', 'e', 'f', 'L', 'R', 'alpha', 'A1', 'A2', 'C1', 'C2', 'D1', 'D2', 'cantitate', 's_unit', 's_tot', 'Od', 'H', 'F', 'nr_stuturi', 'G'].includes(field);
      const isReadOnly = ['s_unit', 's_tot', 'nr', 'dimText'].includes(field);

      if (isReadOnly) {
        rowHtml += `
          <td id="sheet-cell-${rowIdx}-${field}" style="font-weight: 700; color: ${field === 's_tot' ? '#15803d' : 'var(--text-main)'}; font-size: 11.5px; text-align: ${isNum ? 'right' : 'left'}; padding: 4px 8px; white-space: nowrap;">
            ${val !== '' ? val : '-'}
          </td>
        `;
      } else {
        rowHtml += `
          <td style="padding: 2px 4px;">
            <input class="cell-input ${isNum ? 'cell-input-num' : ''}" 
                   type="${isNum ? 'number' : 'text'}" 
                   value="${val}" 
                   style="${field === 'cod' ? 'font-weight: 700; width: 65px;' : ''}${isNum ? 'min-width: 65px;' : ''}"
                   oninput="updateSheetCell('${sheetName}', ${rowIdx}, '${field}', this.value)">
          </td>
        `;
      }
    });

    rowHtml += `
      <td style="text-align: center; white-space: nowrap;">
        <button class="btn-grid-action" title="Șterge rând" onclick="deleteSheetRow('${sheetName}', ${rowIdx})">
          <svg class="icon-svg" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;

    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });
}

window.updateSheetCell = function(sheetName, rowIdx, field, val) {
  const s = adminState.sheets_v2[sheetName];
  if (!s || !s.rows[rowIdx]) return;
  const row = s.rows[rowIdx];
  const isNum = ['A', 'B', 'C', 'D', 'E', 'e', 'f', 'L', 'R', 'alpha', 'A1', 'A2', 'C1', 'C2', 'D1', 'D2', 'cantitate', 'Od', 'H', 'F', 'nr_stuturi', 'G'].includes(field);
  row[field] = isNum ? (parseFloat(val) || 0) : val;

  const cant = Math.max(0, parseFloat(row.cantitate) || 0);
  let sUnit = 0;
  let dimText = row.dimText || '';

  // Real-time exact Excel formulas for all 16 piece sheets
  if (sheetName === 'Canal drept') {
    const A = parseFloat(row.A) || 0;
    const B = parseFloat(row.B) || 0;
    const L = parseFloat(row.L) || 0;
    dimText = `A=${A};B=${B};L=${L}`;
    sUnit = ((A + B) * 2 * L) / 1000000;
  } else if (sheetName === 'Cot rectangular') {
    const A1 = parseFloat(row.A1) || 0;
    const A2 = parseFloat(row.A2) || A1;
    const B = parseFloat(row.B) || 0;
    const R = parseFloat(row.R) || 100;
    const alpha = parseFloat(row.alpha) || 90;
    dimText = `A1=${A1}; A2 =${A2}; B=${B}; R =${R}; < =${alpha}`;
    const maxA = Math.max(A1, A2);
    sUnit = ((2 * (A1 + R) * (A2 + R) + B * Math.PI * (R + maxA / 2)) * (alpha / 90)) / 1000000;
  } else if (sheetName === 'Cot rectangular drept') {
    const A1 = parseFloat(row.A1) || 0;
    const A2 = parseFloat(row.A2) || A1;
    const B = parseFloat(row.B) || 0;
    const R = parseFloat(row.R) || 100;
    const alpha = parseFloat(row.alpha) || 90;
    dimText = `A1=${A1}; A2 =${A2}; B=${B}; R =${R}; < =${alpha}`;
    sUnit = Math.round((((A1/1000 + R/1000)*(A2/1000 + R/1000)*2 + (A1/1000 + A2/1000 + 4*R/1000)*B/1000) * (alpha/90)) * 100) / 100;
  } else if (sheetName === 'Cot rectangular cu dirijori') {
    const A1 = parseFloat(row.A1) || 0;
    const A2 = parseFloat(row.A2) || A1;
    const B = parseFloat(row.B) || 0;
    const R = parseFloat(row.R) || 100;
    const alpha = parseFloat(row.alpha) || 90;
    const cod = String(row.cod || 'CRDir1').trim();
    dimText = `A1=${A1}; A2 =${A2}; B=${B}; R =${R}; < =${alpha}`;
    let vaneArea = 0;
    if (cod === 'CRDir1') {
      vaneArea = Math.PI * (A1 / 3 + R) * (B / 2);
    } else if (cod === 'CRDir2') {
      vaneArea = Math.PI * ((A1 / 4 + R) + (A1 / 2 + R)) * (B / 2);
    } else {
      vaneArea = Math.PI * ((A1 / 8 + R) + (A1 / 3 + R) + (A1 / 2 + R)) * (B / 2);
    }
    sUnit = Math.round((((2 * (A1 + R) * (A2 + R) + Math.PI * B * (2 * R + A1) / 2 + vaneArea) * (alpha / 90)) / 1000000) * 100) / 100;
  } else if (sheetName === 'Teu') {
    const A = parseFloat(row.A) || 0;
    const B = parseFloat(row.B) || 0;
    const C = parseFloat(row.C) || 0;
    const R = parseFloat(row.R) || 100;
    const L = parseFloat(row.L) || (A + 200);
    dimText = `A=${A}; B=${B}; C=${C}; R=${R}; L=${L}`;
    sUnit = ((2 * (C / 1000 + R / 1000) + B / 1000) * L / 1000 + (L / 1000 - A / 1000 + 2 * R / 1000) * B / 1000);
  } else if (sheetName === 'Piesa de deviatie (etaj)') {
    const A = parseFloat(row.A) || 0;
    const B = parseFloat(row.B) || 0;
    const F = parseFloat(row.F) || 0;
    const L = parseFloat(row.L) || 0;
    dimText = `A=${A}; B=${B}; F=${F}; L=${L}`;
    sUnit = 2 * (A / 1000 + F / 1000) * L / 1000 + Math.sqrt(Math.pow(F / 1000, 2) + Math.pow(L / 1000, 2)) * (B / 1000) * 2;
  } else if (sheetName === 'Reductie simetrica_asim.') {
    const A = parseFloat(row.A) || 0;
    const B = parseFloat(row.B) || 0;
    const C = parseFloat(row.C) || 0;
    const D = parseFloat(row.D) || 0;
    const e = parseFloat(row.e) || 0;
    const f = parseFloat(row.f) || 0;
    const L = parseFloat(row.L) || 300;
    dimText = `A=${A}; B=${B}; C=${C};D=${D}; e=${e};f=${f};L=${L}`;
    const factor = L <= 250 ? 1.1 : 1.0;
    sUnit = (((B + D) * Math.sqrt(L * L + e * e) / 2 + (B + D) * Math.sqrt(L * L + Math.pow(A - C - e, 2)) / 2 + (A + C) * Math.sqrt(L * L + f * f) / 2 + (A + C) * Math.sqrt(L * L + Math.pow(B - D - f, 2))) / 1000000) * factor;
  } else if (sheetName === 'YAKA') {
    const A = parseFloat(row.A) || 0;
    const B = parseFloat(row.B) || 0;
    const C = parseFloat(row.C) || 0;
    const L = parseFloat(row.L) || 0;
    const G = parseFloat(row.G) || 0;
    dimText = `A=${A}; B=${B}; C=${C};L=${L}; G=${G}`;
    sUnit = (Math.max((A + B) * 2, (C + B) * 2) * (L + G)) / 1000000;
  } else if (sheetName === 'Ramif. bilaterala (2 coturi)') {
    const C1 = parseFloat(row.C1) || 0;
    const C2 = parseFloat(row.C2) || 0;
    const B = parseFloat(row.B) || 0;
    const R = parseFloat(row.R) || 100;
    const D1 = parseFloat(row.D1) || 0;
    const D2 = parseFloat(row.D2) || 0;
    const alpha = parseFloat(row.alpha) || 90;
    dimText = `C1=${C1}; C2=${C2}; B=${B}; R=${R}; D1=${D1}; D2=${D2}; <=${alpha}`;
    sUnit = (((C1 + R) * (C2 + R) * 2 + Math.PI * B * (2 * R + C1) / 2) * alpha / 90 + ((D1 + R) * (D2 + R) * 2 + Math.PI * B * (2 * R + D1) / 2) * alpha / 90) / 1000000;
  } else if (sheetName === 'Ramif. laterala(cot+canal)') {
    const D1 = parseFloat(row.D1) || 0;
    const D2 = parseFloat(row.D2) || 0;
    const B = parseFloat(row.B) || 0;
    const R = parseFloat(row.R) || 100;
    const C1 = parseFloat(row.C1) || 0;
    const C2 = parseFloat(row.C2) || 0;
    const alpha = parseFloat(row.alpha) || 90;
    const L = parseFloat(row.L) || 500;
    dimText = `D1=${D1}; D2=${D2}; B=${B}; R=${R}; C1=${C1}; C2=${C2}; <=${alpha}; L=${L}`;
    sUnit = (((D1 + R) * (D2 + R) * 2 + Math.PI * B * (2 * R + D1) / 2) * alpha / 90 + Math.max((C1 + B) * 2, (C2 + B) * 2) * L) / 1000000;
  } else if (sheetName === 'Ramif. pantalon') {
    const A = parseFloat(row.A) || 0;
    const B = parseFloat(row.B) || 0;
    const C = parseFloat(row.C) || 0;
    const D = parseFloat(row.D) || 0;
    const E = parseFloat(row.E) || 0;
    const H = parseFloat(row.H) || 0;
    const L = parseFloat(row.L) || 0;
    dimText = `A=${A}; B=${B}; C=${C}; D=${D}; E=${E}; H=${H}; L=${L}`;
    sUnit = (Math.max((A + B) * 2, (C + D + E + B) * 2) * L + 2 * Math.sqrt(H * H + (E * E) / 4) * B) / 1000000;
  } else if (sheetName === 'Capac') {
    const A = parseFloat(row.A) || 0;
    const B = parseFloat(row.B) || 0;
    dimText = `A=${A}; B=${B}`;
    sUnit = ((A + 60) * (B + 60)) / 1000000;
  } else if (sheetName === 'Schimbare sec.concentrica' || sheetName === 'Schimbare sec.excentrica') {
    const Od = parseFloat(row.Od) || 0;
    const A = parseFloat(row.A) || 0;
    const B = parseFloat(row.B) || 0;
    const L = parseFloat(row.L) || 600;
    dimText = `Ød=${Od}; A=${A}; B=${B}; L=${L}`;
    if (B > 0 && Od > 0 && L > 0) {
      sUnit = 3.14 * Math.sqrt(Math.pow(((A + B) / 3.14) - (Od / 2), 2) + L * L) * (1 + 0.06 * A / B + 0.09 * A / Od + 0.25 * 500 / (4 * L)) * ((A + B) / 3.14 + Od / 2) / 1000000;
    }
  } else if (sheetName === 'Plenum') {
    const A = parseFloat(row.A) || 0;
    const B = parseFloat(row.B) || 0;
    const H = parseFloat(row.H) || 0;
    const Od = parseFloat(row.Od) || 0;
    const nrStut = parseFloat(row.nr_stuturi) || 0;
    dimText = `A=${A};B=${B};H=${H};Ø=${Od};Nr Stut=${nrStut}`;
    sUnit = ((A * B) + 2 * (A + B) * H + Math.PI * Od * 100 * nrStut) / 1000000;
  }

  row.dimText = dimText;
  row.s_unit = parseFloat((sUnit || 0).toFixed(4));
  row.s_tot = parseFloat((row.s_unit * cant).toFixed(4));

  // Update DOM cells
  const cellSunit = document.getElementById(`sheet-cell-${rowIdx}-s_unit`);
  if (cellSunit) cellSunit.textContent = row.s_unit;
  const cellStot = document.getElementById(`sheet-cell-${rowIdx}-s_tot`);
  if (cellStot) cellStot.textContent = row.s_tot;
  const cellDimText = document.getElementById(`sheet-cell-${rowIdx}-dimText`);
  if (cellDimText) cellDimText.textContent = row.dimText;

  // Real-time synchronization to Comanda / Customer Cart Items
  const targetItem = adminState.items.find(it => 
    (row.eticheta && it.eticheta === row.eticheta) || 
    (it.cod === row.cod && it.nr === row.nr)
  );

  if (targetItem) {
    targetItem.dimensiuni = row.dimText;
    targetItem.cantitate = cant;
    targetItem.sUnit = row.s_unit;
    targetItem.suprafata = row.s_tot;
    targetItem.valoareTotala = parseFloat((row.s_tot * (adminState.settings.pretMpRectangular || 15.0)).toFixed(2));
    updateAdminMetrics();
    updateAdminAtelierBreakdown();
  }

  debounceSaveAdminData();
};

window.deleteSheetRow = function(sheetName, rowIdx) {
  const s = adminState.sheets_v2[sheetName];
  if (!s || !s.rows) return;
  s.rows.splice(rowIdx, 1);
  s.rows.forEach((r, idx) => { if (r.nr !== undefined) r.nr = idx + 1; });
  renderCustomSheetTable(sheetName);
  renderExcelSheetTabs();
  debounceSaveAdminData();
  showToast(`Rândul a fost șters din ${sheetName}!`, 'info');
};

function addNewSheetRow(sheetName) {
  const s = adminState.sheets_v2[sheetName];
  if (!s) return;
  if (!s.rows) s.rows = [];

  const newRow = { id: `${sheetName}_new_${Date.now()}` };
  (s.fields || []).forEach(f => {
    if (f === 'nr') newRow[f] = s.rows.length + 1;
    else if (f === 'sistem') newRow[f] = 'Tubulatura Ventilatie';
    else if (f === 'um') newRow[f] = 'buc';
    else if (f === 'cantitate') newRow[f] = 1;
    else if (['A', 'B', 'L', 'A1', 'A2', 'C', 'D', 'R', 'alpha'].includes(f)) newRow[f] = 500;
    else newRow[f] = '';
  });

  s.rows.push(newRow);
  renderCustomSheetTable(sheetName);
  renderExcelSheetTabs();
  debounceSaveAdminData();
  showToast(`Poziție nouă adăugată în ${sheetName}!`, 'success');
}

// Auto-Save cu Debounce și Sincronizare Realtime cu Site-ul Clientului
let adminSaveTimer = null;
function debounceSaveAdminData() {
  clearTimeout(adminSaveTimer);
  adminSaveTimer = setTimeout(async () => {
    await saveAdminDataSilently();
  }, 350);
}

async function saveAdminDataSilently() {
  try {
    const payload = {
      meta: adminState.meta,
      items: adminState.items,
      sheets_v2: adminState.sheets_v2,
      settings: adminState.settings
    };
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      notifyClientSync();
    }
  } catch (e) {
    console.error('Save error:', e);
  }
}

function notifyClientSync() {
  const syncTime = Date.now();
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('kronvent_sync');
      ch.postMessage({ type: 'DATA_UPDATED', timestamp: syncTime });
    }
    localStorage.setItem('kronvent_sync_timestamp', syncTime.toString());
  } catch (e) {
    console.warn('Sync broadcast error:', e);
  }
}

function renderAdminTable() {
  const tbody = document.getElementById('admin-items-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const q = adminState.filters.search.toLowerCase();
  const cat = adminState.filters.category;

  const filtered = adminState.items.map((it, originalIdx) => ({ it, originalIdx })).filter(({ it }) => {
    const matchesSearch = !q || 
      (it.eticheta && it.eticheta.toLowerCase().includes(q)) || 
      (it.dimensiuni && it.dimensiuni.toLowerCase().includes(q)) || 
      (it.cod && it.cod.toLowerCase().includes(q));
    const matchesCat = cat === 'all' || it.categorie === cat;
    return matchesSearch && matchesCat;
  });

  const countEl = document.getElementById('admin-filter-count');
  if (countEl) countEl.textContent = filtered.length;

  let totCant = 0, totSup = 0, totVal = 0, totGreut = 0;

  filtered.forEach(({ it, originalIdx }) => {
    totCant += parseFloat(it.cantitate) || 0;
    totSup += parseFloat(it.suprafata) || 0;
    totVal += parseFloat(it.valoareTotala) || 0;
    totGreut += parseFloat(it.greutate) || 0;

    const tr = document.createElement('tr');
    tr.id = `admin-row-${originalIdx}`;

    // Generate categories select options
    const catOptionsHtml = CATEGORIES_OPTIONS.map(c => 
      `<option value="${c}" ${it.categorie === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    const flansaOptionsHtml = ['FLANSA20', 'FLANSA30', 'Fără Flanșă', 'Niplu'].map(f => 
      `<option value="${f}" ${it.flansa === f ? 'selected' : ''}>${f}</option>`
    ).join('');

    const grosimeOptionsHtml = ['0.6', '0.8', '1.0', '1.2'].map(g => 
      `<option value="${g}" ${it.grosime == g ? 'selected' : ''}>${g} mm</option>`
    ).join('');

    tr.innerHTML = `
      <td style="text-align: center; color: #2563eb; font-weight: 700; font-size: 11px;">${it.nr}</td>
      <td>
        <input class="cell-input" type="text" value="${it.eticheta || ''}" onchange="updateItemField(${originalIdx}, 'eticheta', this.value)">
      </td>
      <td>
        <select class="cell-select" onchange="updateItemField(${originalIdx}, 'categorie', this.value)">
          ${catOptionsHtml}
        </select>
      </td>
      <td>
        <input class="cell-input" style="font-weight: 700;" type="text" value="${it.cod || ''}" onchange="updateItemField(${originalIdx}, 'cod', this.value)">
      </td>
      <td>
        <input class="cell-input" style="font-size: 12px; font-weight: 500;" type="text" value="${it.dimensiuni || ''}" onchange="updateItemField(${originalIdx}, 'dimensiuni', this.value)">
      </td>
      <td>
        <input class="cell-input cell-input-num" type="number" min="1" step="1" value="${it.cantitate || 1}" oninput="updateItemField(${originalIdx}, 'cantitate', this.value)">
      </td>
      <td>
        <input class="cell-input cell-input-num" type="number" min="0" step="0.001" value="${(it.sUnit || 0).toFixed(4)}" oninput="updateItemField(${originalIdx}, 'sUnit', this.value)">
      </td>
      <td style="text-align: right; padding-right: 8px;">
        <strong style="color: #15803d; font-size: 12px;" id="cell-stot-${originalIdx}">${(it.suprafata || 0).toFixed(4)}</strong>
      </td>
      <td>
        <input class="cell-input cell-input-num" type="number" min="0" step="0.1" value="${(it.pretUnitar || 0).toFixed(2)}" oninput="updateItemField(${originalIdx}, 'pretUnitar', this.value)">
      </td>
      <td style="text-align: right; padding-right: 8px;">
        <strong style="color: #0f172a; font-size: 12px;" id="cell-val-${originalIdx}">${(it.valoareTotala || 0).toFixed(2)} €</strong>
      </td>
      <td>
        <select class="cell-select" onchange="updateItemField(${originalIdx}, 'flansa', this.value)">
          ${flansaOptionsHtml}
        </select>
      </td>
      <td>
        <select class="cell-select" onchange="updateItemField(${originalIdx}, 'grosime', this.value)">
          ${grosimeOptionsHtml}
        </select>
      </td>
      <td style="text-align: center; white-space: nowrap;">
        <button class="btn-grid-action btn-grid-action-clone" title="Duplică rând" onclick="duplicateItem(${originalIdx})">
          <svg class="icon-svg" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
        <button class="btn-grid-action" title="Șterge rând" onclick="deleteItem(${originalIdx})">
          <svg class="icon-svg" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const footCant = document.getElementById('admin-foot-cantitate');
  if (footCant) footCant.textContent = `${Math.round(totCant)} buc`;
  const footSup = document.getElementById('admin-foot-suprafata');
  if (footSup) footSup.textContent = `${totSup.toFixed(2)} m²`;
  const footVal = document.getElementById('admin-foot-valoare');
  if (footVal) footVal.textContent = `${totVal.toFixed(2)} € (${(totVal * adminState.settings.cursEur).toFixed(2)} RON)`;
  const footGreut = document.getElementById('admin-foot-greutate');
  if (footGreut) footGreut.textContent = `Greutate: ${totGreut.toFixed(1)} kg`;
}

// Global update handler for inline table editing
window.updateItemField = function(idx, field, value) {
  const item = adminState.items[idx];
  if (!item) return;

  item[field] = value;

  if (field === 'cantitate' || field === 'sUnit') {
    const cant = Math.max(1, parseFloat(item.cantitate) || 1);
    const sUnit = parseFloat(item.sUnit) || 0;
    item.cantitate = cant;
    item.suprafata = parseFloat((sUnit * cant).toFixed(4));
    
    // Recalculate price if applicable
    if (item.pretUnitar) {
      item.valoareTotala = parseFloat((item.suprafata * (adminState.settings.pretMpRectangular || 15.0)).toFixed(2));
    }
    
    const cellStot = document.getElementById(`cell-stot-${idx}`);
    if (cellStot) cellStot.textContent = item.suprafata.toFixed(4);
    const cellVal = document.getElementById(`cell-val-${idx}`);
    if (cellVal) cellVal.textContent = `${(item.valoareTotala || 0).toFixed(2)} €`;
  }

  if (field === 'pretUnitar') {
    const pret = parseFloat(value) || 0;
    item.pretUnitar = pret;
    item.valoareTotala = parseFloat(((item.suprafata || item.cantitate || 1) * pret).toFixed(2));
    const cellVal = document.getElementById(`cell-val-${idx}`);
    if (cellVal) cellVal.textContent = `${item.valoareTotala.toFixed(2)} €`;
  }

  if (field === 'grosime') {
    const gStr = value.toString();
    const density = gStr.includes('0.6') ? 4.71 : (gStr.includes('1.0') ? 7.85 : 6.28);
    item.greutate = parseFloat(((item.suprafata || 0) * density).toFixed(2));
  }

  updateAdminMetrics();
  updateAdminAtelierBreakdown();
  debounceSaveAdminData();
};

window.deleteItem = function(idx) {
  if (adminState.items.length <= 1) {
    showToast('Tabelul trebuie să conțină cel puțin o poziție!', 'warning');
    return;
  }
  adminState.items.splice(idx, 1);
  adminState.items.forEach((it, i) => it.nr = i + 1);
  renderAdminTable();
  updateAdminMetrics();
  updateAdminAtelierBreakdown();
  renderExcelSheetTabs();
  debounceSaveAdminData();
};

window.duplicateItem = function(idx) {
  const source = adminState.items[idx];
  if (!source) return;
  const clone = { ...source, eticheta: `${source.eticheta || 'Piesa'}-Copie` };
  adminState.items.splice(idx + 1, 0, clone);
  adminState.items.forEach((it, i) => it.nr = i + 1);
  renderAdminTable();
  updateAdminMetrics();
  updateAdminAtelierBreakdown();
  renderExcelSheetTabs();
  debounceSaveAdminData();
};

function addNewRow() {
  if (adminState.currentSheet !== 'Comanda') {
    addNewSheetRow(adminState.currentSheet);
    return;
  }

  const newNr = adminState.items.length + 1;
  const newItem = {
    nr: 1,
    eticheta: `Piesa-Noua-${newNr}`,
    categorie: 'Canal drept',
    sistem: 'Tubulatura Ventilatie',
    cod: 'CRD',
    dimensiuni: 'A=600;B=400;L=1250',
    um: 'buc',
    cantitate: 1,
    sUnit: 2.5000,
    suprafata: 2.5000,
    pretUnitar: 37.50,
    valoareTotala: 37.50,
    flansa: 'FLANSA20',
    grosime: '0.8',
    coltari: 8,
    greutate: 15.7
  };

  adminState.items.unshift(newItem);
  adminState.items.forEach((it, i) => it.nr = i + 1);
  renderAdminTable();
  updateAdminMetrics();
  updateAdminAtelierBreakdown();
  renderExcelSheetTabs();
  debounceSaveAdminData();

  // Scroll to table top
  const firstInput = document.querySelector('#admin-items-tbody input');
  if (firstInput) firstInput.focus();
}

// Excel File Upload & Parser
function handleExcelFile(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    showToast('Biblioteca XLSX nu este încărcată.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Look for sheet 'Comanda' or first sheet
      const sheetName = workbook.SheetNames.includes('Comanda') ? 'Comanda' : workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (!jsonRows || jsonRows.length < 2) {
        showToast('Fișierul Excel nu conține rânduri valide de date.', 'error');
        return;
      }

      // Try to parse rows into items
      const newItems = [];
      let startRow = 1;
      // check if header row exists
      const header = jsonRows[0].map(h => (h || '').toString().toLowerCase());
      
      for (let r = 1; r < jsonRows.length; r++) {
        const row = jsonRows[r];
        if (!row || row.length === 0 || !row[1]) continue;

        const rawItem = {
          nr: newItems.length + 1,
          eticheta: row[1] || `Poz-${newItems.length + 1}`,
          categorie: row[2] || 'Canal drept',
          cod: row[3] || 'CRD',
          dimensiuni: row[4] || '',
          cantitate: parseFloat(row[5]) || 1,
          um: row[6] || 'buc',
          sUnit: parseFloat(row[7]) || 1.0,
          suprafata: parseFloat(row[8]) || 1.0,
          pretUnitar: parseFloat(row[9]) || 15.0,
          valoareTotala: parseFloat(row[10]) || 15.0,
          flansa: row[11] || 'FLANSA20',
          grosime: (row[12] || '0.8').toString().replace(' mm', '')
        };

        newItems.push(enrichAdminItem(rawItem, newItems.length + 1));
      }

      if (newItems.length > 0) {
        adminState.items = newItems;
        renderAdminTable();
        updateAdminMetrics();
        updateAdminAtelierBreakdown();
        showToast(`Fișierul Excel "${file.name}" a fost importat cu succes! S-au încărcat ${newItems.length} poziții de producție.`, 'success');
      } else {
        showToast('Nu s-au putut extrage poziții valide din fișierul Excel încărcat.', 'warning');
      }
    } catch (err) {
      console.error('Eroare import Excel:', err);
      showToast('Eroare la procesarea fișierului Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Download Excel File with Complete Structure (All Sheets)
function downloadExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Biblioteca Excel nu este disponibilă.', 'error');
    return;
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Comanda
  const comandaRows = [
    ['Nr', 'Denumire / Eticheta', 'Categorie', 'Cod', 'Dimensiuni', 'Cantitate', 'UM', 'Suprafata Unitar', 'Suprafata Totala', 'Pret Unitar EUR', 'Valoare EUR', 'Flansa', 'Grosime mm']
  ];

  adminState.items.forEach(it => {
    comandaRows.push([
      it.nr,
      it.eticheta,
      it.categorie,
      it.cod,
      it.dimensiuni,
      it.cantitate,
      it.um || 'buc',
      it.sUnit,
      it.suprafata,
      it.pretUnitar,
      it.valoareTotala,
      it.flansa,
      it.grosime
    ]);
  });

  const wsComanda = XLSX.utils.aoa_to_sheet(comandaRows);
  XLSX.utils.book_append_sheet(wb, wsComanda, 'Comanda');

  // Add all sheets from sheets_v2
  const sheetNames = Object.keys(adminState.sheets_v2 || {});
  sheetNames.forEach(sheetName => {
    const s = adminState.sheets_v2[sheetName];
    if (!s || !s.headers || !s.fields) return;
    const sRows = [s.headers];
    (s.rows || []).forEach(r => {
      const rVals = s.fields.map(f => r[f] !== undefined ? r[f] : '');
      sRows.push(rVals);
    });
    const ws = XLSX.utils.aoa_to_sheet(sRows);
    const validName = sheetName.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, validName);
  });

  // Sheet: Materiale Atelier
  const atelierRows = [
    ['Material', 'Consum Calculat', 'UM'],
    ['Tabla Zincata 0.6 mm', document.getElementById('mat-tabla-06') ? document.getElementById('mat-tabla-06').textContent : '', 'm²'],
    ['Tabla Zincata 0.8 mm', document.getElementById('mat-tabla-08') ? document.getElementById('mat-tabla-08').textContent : '', 'm²'],
    ['Tabla Zincata 1.0 mm', document.getElementById('mat-tabla-10') ? document.getElementById('mat-tabla-10').textContent : '', 'm²'],
    ['Profil Flansa 20', document.getElementById('mat-flansa-20') ? document.getElementById('mat-flansa-20').textContent : '', 'ml'],
    ['Profil Flansa 30', document.getElementById('mat-flansa-30') ? document.getElementById('mat-flansa-30').textContent : '', 'ml'],
    ['Coltari 20', document.getElementById('mat-coltari-20') ? document.getElementById('mat-coltari-20').textContent : '', 'buc'],
    ['Coltari 30', document.getElementById('mat-coltari-30') ? document.getElementById('mat-coltari-30').textContent : '', 'buc'],
    ['Garnitura Etansare', document.getElementById('mat-gasket') ? document.getElementById('mat-gasket').textContent : '', 'ml']
  ];
  const wsAtelier = XLSX.utils.aoa_to_sheet(atelierRows);
  XLSX.utils.book_append_sheet(wb, wsAtelier, 'Consumuri Materiale');

  // Sheet: Setari Comerciale
  const setariRows = [
    ['Parametru', 'Valoare'],
    ['Pret Baza Rectangular (€/m²)', adminState.settings.pretMpRectangular],
    ['Curs BNR (RON/EUR)', adminState.settings.cursEur],
    ['Data Curs BNR', adminState.settings.cursBnrDate],
    ['Cota TVA (%)', adminState.settings.tva]
  ];
  const wsSetari = XLSX.utils.aoa_to_sheet(setariRows);
  XLSX.utils.book_append_sheet(wb, wsSetari, 'Setari');

  const fileName = `KronVent_Calcul_EXACT_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`Fișierul Excel complet cu toate foile (${sheetNames.length + 3} foi) a fost descărcat!`, 'success');
}

// Save Data to Server with full sheets and live client broadcast
async function saveAdminData() {
  try {
    const payload = {
      meta: adminState.meta,
      items: adminState.items,
      sheets_v2: adminState.sheets_v2,
      settings: adminState.settings
    };
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      notifyClientSync();
      showToast('Toate foile Excel și datele au fost salvate cu succes! Modificările sunt active imediat pe site-ul clientului.', 'success');
    } else {
      showToast('Eroare la salvarea datelor pe server.', 'error');
    }
  } catch (e) {
    showToast('Eroare rețea la salvare: ' + e.message, 'error');
  }
}

function setupAdminListeners() {
  // Search & Filters
  const searchInput = document.getElementById('admin-table-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      adminState.filters.search = e.target.value;
      renderAdminTable();
    });
  }

  const catSelect = document.getElementById('admin-filter-categorie');
  if (catSelect) {
    catSelect.addEventListener('change', e => {
      adminState.filters.category = e.target.value;
      renderAdminTable();
    });
  }

  // Add Row Button
  const btnAddRow = document.getElementById('admin-btn-add-row');
  if (btnAddRow) {
    btnAddRow.addEventListener('click', addNewRow);
  }

  // Upload Excel Button & File Input
  const btnUploadTrigger = document.getElementById('admin-btn-upload-excel');
  const fileInput = document.getElementById('admin-excel-file-input');
  if (btnUploadTrigger && fileInput) {
    btnUploadTrigger.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleExcelFile(e.target.files[0]);
      }
    });
  }

  // Dropzone drag & drop
  const dropzone = document.getElementById('admin-excel-dropzone');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleExcelFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Download Excel Buttons
  const btnDownloadExcel = document.getElementById('admin-btn-download-excel-file');
  if (btnDownloadExcel) btnDownloadExcel.addEventListener('click', downloadExcel);
  const btnExportExcel = document.getElementById('admin-btn-export-excel');
  if (btnExportExcel) btnExportExcel.addEventListener('click', downloadExcel);

  // Save Buttons
  const btnSaveInline = document.getElementById('admin-btn-save-inline');
  if (btnSaveInline) btnSaveInline.addEventListener('click', saveAdminData);
  const btnSave = document.getElementById('admin-btn-save');
  if (btnSave) btnSave.addEventListener('click', saveAdminData);

  // Sync BNR Button
  const btnSyncBnr = document.getElementById('admin-btn-sync-bnr');
  if (btnSyncBnr) {
    btnSyncBnr.addEventListener('click', async () => {
      btnSyncBnr.disabled = true;
      btnSyncBnr.innerHTML = `<span>Sincronizare...</span>`;
      await fetchBnrForAdmin();
      updateAdminMetrics();
      renderAdminTable();
      btnSyncBnr.disabled = false;
      btnSyncBnr.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg><span>Sincronizează Curs BNR</span>`;
    });
  }

  // Save Settings Buttons (both top and comprehensive)
  const btnSaveSettings = document.getElementById('admin-btn-save-settings');
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', saveAllSettings);
  }

  // Reset Button
  const btnReset = document.getElementById('admin-btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      showAppConfirm(
        'Resetare Bază de Date',
        'Sigur doriți să resetați baza de date a fabricii la valorile inițiale din fișierul Excel? Toate modificările curente vor fi suprascrise.',
        async () => {
          try {
            const res = await fetch('/api/reset', { method: 'POST' });
            if (res.ok) {
              showToast('Baza de date a fost resetată cu succes!', 'success');
              await loadAdminData();
            } else {
              showToast('Eroare la resetarea datelor.', 'error');
            }
          } catch (e) {
            showToast('Eroare rețea: ' + e.message, 'error');
          }
        },
        null,
        'Da, Resetează Datele',
        'Renunță',
        true
      );
    });
  }
}

// ====================================================================
// IN-APP NOTIFICATIONS & MODAL DIALOGS (NO BROWSER NATIVE POPUPS)
// ====================================================================
function showToast(msg, type = 'info') {
  const existing = document.querySelectorAll('.mac-toast');
  existing.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `mac-toast toast-${type}`;

  let iconSvg = `<svg class="icon-svg" style="width: 16px; height: 16px; flex-shrink: 0;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  if (type === 'success') {
    iconSvg = `<svg class="icon-svg" style="width: 16px; height: 16px; flex-shrink: 0; color: #4ade80;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="icon-svg" style="width: 16px; height: 16px; flex-shrink: 0; color: #f87171;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else if (type === 'warning') {
    iconSvg = `<svg class="icon-svg" style="width: 16px; height: 16px; flex-shrink: 0; color: #fbbf24;" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${msg}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function showAppConfirm(title, message, onConfirm, onCancel, confirmText = 'Confirmă', cancelText = 'Anulează', isDanger = false) {
  const existing = document.getElementById('kronvent-app-dialog');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'kronvent-app-dialog';
  overlay.className = 'app-dialog-overlay';

  const iconClass = isDanger ? 'icon-danger' : 'icon-warning';
  const iconSvg = isDanger 
    ? `<svg class="icon-svg" style="width: 20px; height: 20px;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`
    : `<svg class="icon-svg" style="width: 20px; height: 20px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  overlay.innerHTML = `
    <div class="app-dialog-card">
      <div class="app-dialog-header">
        <div class="app-dialog-icon ${iconClass}">
          ${iconSvg}
        </div>
        <div>
          <h3 class="app-dialog-title">${title}</h3>
          <p class="app-dialog-message">${message}</p>
        </div>
      </div>
      <div class="app-dialog-actions">
        <button id="dialog-cancel-btn" class="k-btn k-btn-secondary" style="padding: 8px 16px; font-size: 13px;">${cancelText}</button>
        <button id="dialog-confirm-btn" class="k-btn ${isDanger ? 'k-btn-danger' : 'k-btn-primary'}" style="padding: 8px 18px; font-size: 13px; font-weight: 700;">${confirmText}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const closeDialog = () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('#dialog-confirm-btn').addEventListener('click', () => {
    closeDialog();
    if (typeof onConfirm === 'function') onConfirm();
  });

  overlay.querySelector('#dialog-cancel-btn').addEventListener('click', () => {
    closeDialog();
    if (typeof onCancel === 'function') onCancel();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeDialog();
      if (typeof onCancel === 'function') onCancel();
    }
  });
}

// Strictly override native browser alert & confirm to prevent any browser popups
window.alert = function(msg) {
  showToast(String(msg), 'info');
};

window.confirm = function(msg) {
  console.warn('Native confirm blocked; use in-app modal instead:', msg);
  return true;
};

// ====================================================================
// MULTI-YEAR ARCHITECTURE, TECHNICAL RULES & IMMUTABLE SNAPSHOT LOGIC
// ====================================================================

const STANDARD_SPIRO_DIAMETERS = [
  100, 125, 150, 160, 200, 250, 315, 355, 400, 450, 500, 630, 800, 1000, 1250
];

async function loadYearsAndParameters() {
  try {
    // 1. Fetch Years
    const resYears = await fetch('/api/years');
    if (resYears.ok) {
      const dataYears = await resYears.json();
      adminState.yearsData.activeYear = dataYears.activeYear || 2026;
      adminState.yearsData.years = dataYears.years || [];

      // Update Header / Tab Badges
      const badgeNav = document.getElementById('admin-active-year-badge');
      if (badgeNav) badgeNav.textContent = `${adminState.yearsData.activeYear} ACTIV`;

      const pillCurrent = document.getElementById('admin-year-current-pill');
      if (pillCurrent) pillCurrent.textContent = `${adminState.yearsData.activeYear} ACTIV`;

      // Populate year selects
      populateYearSelects();
      renderYearsTable();
    }

    // 2. Fetch Parameters for Active Year
    const resParams = await fetch(`/api/parameters?year=${adminState.yearsData.activeYear}`);
    if (resParams.ok) {
      const dataParams = await resParams.json();
      if (dataParams.settings) {
        Object.assign(adminState.settings, dataParams.settings);
        populateTechnicalSettingsInputs(dataParams.settings);
      }
      adminState.yearsData.spiroPrices = dataParams.spiroPrices || {};
      renderSpiroMatrix();
    }

    // 3. Fetch Orders
    const resOrders = await fetch('/api/orders');
    if (resOrders.ok) {
      const orders = await resOrders.json();
      adminState.yearsData.orders = orders || [];
      renderOrdersTable();
      if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
    }
  } catch (err) {
    console.error('Eroare la încărcarea anilor și parametrilor:', err);
  }
}

function populateYearSelects() {
  const activeSelect = document.getElementById('admin-select-active-year');
  const cloneSelect = document.getElementById('admin-select-clone-from');
  if (!activeSelect || !cloneSelect) return;

  activeSelect.innerHTML = '';
  cloneSelect.innerHTML = '';

  adminState.yearsData.years.forEach(y => {
    const optActive = document.createElement('option');
    optActive.value = y.year;
    optActive.textContent = `Anul ${y.year} ${y.year === adminState.yearsData.activeYear ? '(Activ)' : ''}`;
    if (y.year === adminState.yearsData.activeYear) optActive.selected = true;
    activeSelect.appendChild(optActive);

    const optClone = document.createElement('option');
    optClone.value = y.year;
    optClone.textContent = `Clonează din ${y.year}`;
    if (y.year === adminState.yearsData.activeYear) optClone.selected = true;
    cloneSelect.appendChild(optClone);
  });
}

function populateTechnicalSettingsInputs(s) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  };
  setVal('admin-setting-pret-mp', s.pretMpRectangular || 15.0);
  setVal('admin-setting-curs-eur', s.cursEur || 5.2542);
  setVal('admin-setting-tva', s.tva !== undefined ? s.tva : 21);
  setVal('admin-setting-flansa-prag', s.flansaPerimeterThreshold || 3500);
  setVal('admin-setting-grosime-prag1', s.dimGrosimePrag1 || 500);
  setVal('admin-setting-grosime-prag2', s.dimGrosimePrag2 || 1000);
  setVal('admin-setting-density-06', s.density06 || 4.71);
  setVal('admin-setting-density-08', s.density08 || 6.28);
  setVal('admin-setting-density-10', s.density10 || 7.85);
  setVal('admin-setting-clips-step', s.clipsStep || 350);
  setVal('admin-setting-silicon-step', s.siliconStep || 18);
}

function renderYearsTable() {
  const tbody = document.getElementById('admin-years-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  adminState.yearsData.years.forEach(y => {
    const isActive = y.year === adminState.yearsData.activeYear;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${y.year}</strong></td>
      <td>
        <span class="${isActive ? 'badge-year-active' : 'badge-year-archive'}">
          ${isActive ? '● ACTIV' : 'ARHIVAT'}
        </span>
      </td>
      <td style="text-align: right; font-weight: 700;">${y.settings?.pretMpRectangular?.toFixed(2) || '15.00'} €</td>
      <td style="text-align: right;">${y.settings?.cursEur?.toFixed(4) || '5.2542'}</td>
      <td style="text-align: right;">${y.settings?.flansaPerimeterThreshold || 3500} mm</td>
      <td style="text-align: right; font-weight: 600;">${y.ordersCount || 0} comenzi</td>
      <td style="text-align: center;">
        ${isActive 
          ? '<span style="font-size: 11px; color: #16a34a; font-weight: 700;">An de Lucru Activ</span>' 
          : `<button class="k-btn k-btn-secondary k-btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="activateYearDirectly(${y.year})">Activează Anul</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSpiroMatrix() {
  const tbody = document.getElementById('admin-spiro-matrix-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const prices = adminState.yearsData.spiroPrices || {};

  STANDARD_SPIRO_DIAMETERS.forEach(d => {
    const dKey = String(d);
    const rowData = prices[dKey] || defaultSpiroForDiameter(d);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center; font-weight: 700; color: var(--kronvent-blue);">Ø ${d}</td>
      <td><input type="number" class="spiro-matrix-input" step="0.1" data-d="${d}" data-f="spiro" value="${rowData.spiro}"></td>
      <td><input type="number" class="spiro-matrix-input" step="0.1" data-d="${d}" data-f="cot90" value="${rowData.cot90}"></td>
      <td><input type="number" class="spiro-matrix-input" step="0.1" data-d="${d}" data-f="cot45" value="${rowData.cot45}"></td>
      <td><input type="number" class="spiro-matrix-input" step="0.1" data-d="${d}" data-f="teu" value="${rowData.teu}"></td>
      <td><input type="number" class="spiro-matrix-input" step="0.1" data-d="${d}" data-f="red" value="${rowData.red}"></td>
      <td><input type="number" class="spiro-matrix-input" step="0.1" data-d="${d}" data-f="stut" value="${rowData.stut}"></td>
      <td><input type="number" class="spiro-matrix-input" step="0.1" data-d="${d}" data-f="capac" value="${rowData.capac}"></td>
      <td><input type="number" class="spiro-matrix-input" step="0.1" data-d="${d}" data-f="clapeta" value="${rowData.clapeta}"></td>
    `;
    tbody.appendChild(tr);
  });
}

function defaultSpiroForDiameter(d) {
  const factor = d / 100;
  return {
    spiro: parseFloat((6.0 + factor * 2.8).toFixed(1)),
    cot90: parseFloat((7.5 + factor * 4.5).toFixed(1)),
    cot45: parseFloat((6.0 + factor * 3.8).toFixed(1)),
    teu: parseFloat((11.0 + factor * 6.5).toFixed(1)),
    red: parseFloat((8.0 + factor * 4.0).toFixed(1)),
    stut: parseFloat((4.0 + factor * 2.0).toFixed(1)),
    capac: parseFloat((3.5 + factor * 1.8).toFixed(1)),
    clapeta: parseFloat((14.0 + factor * 7.0).toFixed(1))
  };
}

function renderOrdersTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const orders = adminState.yearsData.orders || [];

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 20px;">Nicio comandă salvată încă în registrul pe ani.</td></tr>`;
    return;
  }

  orders.forEach((o, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${o.orderNumber || o.id}</strong></td>
      <td style="text-align: center;"><span class="k-badge" style="font-size: 11px;">${o.year || 2026}</span></td>
      <td>${o.client || 'Client B2B'}</td>
      <td>${o.project || 'Proiect HVAC'}</td>
      <td>${o.date || '-'}</td>
      <td style="text-align: right; font-weight: 600;">${o.totalMp ? o.totalMp.toFixed(2) : '-'} m²</td>
      <td style="text-align: right;">${o.totalPiese || '-'} buc</td>
      <td style="text-align: right; font-weight: 700; color: #15803d;">${o.totalEur ? o.totalEur.toFixed(2) : '-'} €</td>
      <td style="text-align: right;">${o.totalRon ? o.totalRon.toFixed(2) : '-'} RON</td>
      <td style="text-align: center;">
        <button class="k-btn k-btn-secondary k-btn-sm" style="padding: 3px 8px; font-size: 11px; white-space: nowrap;" onclick="inspectOrderSnapshot(${idx})">
          <svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>Vezi Snapshot</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ====================================================================
// EXECUTIVE DASHBOARD, CRM ORDERS & FACTORY REPORTS LOGIC
// ====================================================================
function setupDashboard() {
  const searchInput = document.getElementById('dash-orders-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderDashOrdersTable());
  }

  const statusFilter = document.getElementById('dash-orders-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => renderDashOrdersTable());
  }

  const btnExportExcel = document.getElementById('admin-btn-export-dash-excel');
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', exportOrdersReportExcel);
  }

  const btnRepVanzari = document.getElementById('admin-btn-rep-vanzari');
  if (btnRepVanzari) {
    btnRepVanzari.addEventListener('click', exportOrdersReportExcel);
  }

  const btnRepMateriale = document.getElementById('admin-btn-rep-materiale');
  if (btnRepMateriale) {
    btnRepMateriale.addEventListener('click', exportMaterialsReportExcel);
  }

  const btnRepAtelier = document.getElementById('admin-btn-rep-atelier');
  if (btnRepAtelier) {
    btnRepAtelier.addEventListener('click', () => window.print());
  }

  const btnPrintDash = document.getElementById('admin-btn-print-dash');
  if (btnPrintDash) {
    btnPrintDash.addEventListener('click', () => window.print());
  }

  const btnRefresh = document.getElementById('admin-btn-refresh-dash');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      await loadYearsAndParameters();
      showToast('Datele din panoul de bord au fost actualizate!', 'success');
    });
  }
}

function renderAdminDashboard() {
  const orders = adminState.yearsData.orders || [];
  const cursEur = adminState.settings.cursEur || 5.2542;

  let totEur = 0;
  let totRon = 0;
  let totMp = 0;
  let totPiese = 0;
  let countNoua = 0;
  let countProd = 0;
  let countGata = 0;
  let countFin = 0;

  orders.forEach(o => {
    const valEur = o.totalEur || 0;
    const valRon = o.totalRon || (valEur * cursEur);
    totEur += valEur;
    totRon += valRon;
    totMp += (o.totalMp || 0);
    totPiese += (o.totalPiese || 0);

    const st = (o.status || 'NOUA').toUpperCase();
    if (st === 'IN_PRODUCTIE') countProd++;
    else if (st === 'GATA_LIVRARE') countGata++;
    else if (st === 'FINALIZATA' || st === 'CONFIRMED') countFin++;
    else countNoua++;
  });

  const totOrders = orders.length || 1;
  const avgEur = orders.length > 0 ? (totEur / orders.length) : 0;
  const tonaj = totMp * 6.35; // kg tablă estimată

  // 1. Update KPI Elements
  const elSalesEur = document.getElementById('dash-kpi-sales-eur');
  const elSalesRon = document.getElementById('dash-kpi-sales-ron');
  const elVolumeMp = document.getElementById('dash-kpi-volume-mp');
  const elVolumeTon = document.getElementById('dash-kpi-volume-tonaj');
  const elOrdersCount = document.getElementById('dash-kpi-orders-count');
  const elAvgOrder = document.getElementById('dash-kpi-avg-order');
  const elPipelineSumm = document.getElementById('dash-kpi-pipeline-summary');
  const elPipelineDet = document.getElementById('dash-kpi-pipeline-details');
  const elBadgeCount = document.getElementById('admin-orders-count-badge');

  if (elSalesEur) elSalesEur.textContent = `${totEur.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  if (elSalesRon) elSalesRon.textContent = `${totRon.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON (curs BNR: ${cursEur.toFixed(4)})`;
  if (elVolumeMp) elVolumeMp.textContent = `${totMp.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
  if (elVolumeTon) elVolumeTon.textContent = `~${Math.round(tonaj).toLocaleString('ro-RO')} kg tablă zincată DX51D`;
  if (elOrdersCount) elOrdersCount.textContent = `${orders.length} comenzi`;
  if (elAvgOrder) elAvgOrder.textContent = `Valoare medie: ${avgEur.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / comandă`;
  if (elPipelineSumm) elPipelineSumm.textContent = `${countProd} În Producție`;
  if (elPipelineDet) elPipelineDet.textContent = `${countGata} Gata Livrare • ${countFin} Finalizate • ${countNoua} Noi`;
  if (elBadgeCount) elBadgeCount.textContent = `${orders.length}`;

  // 2. Update Client Revenue Ranking (Pure Sales Focus)
  const elRankingTotal = document.getElementById('dash-ranking-total-eur');
  if (elRankingTotal) elRankingTotal.textContent = `${totEur.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const rankingContainer = document.getElementById('dash-sales-clients-ranking');
  if (rankingContainer) {
    const clientMap = {};
    orders.forEach(o => {
      const cName = (o.client || 'Client B2B').trim();
      if (!clientMap[cName]) {
        clientMap[cName] = {
          name: cName,
          totalEur: 0,
          totalRon: 0,
          ordersCount: 0,
          latestProject: o.project || 'Proiect'
        };
      }
      const valEur = o.totalEur || 0;
      const valRon = o.totalRon || (valEur * cursEur);
      clientMap[cName].totalEur += valEur;
      clientMap[cName].totalRon += valRon;
      clientMap[cName].ordersCount++;
    });

    const sortedClients = Object.values(clientMap).sort((a, b) => b.totalEur - a.totalEur);
    rankingContainer.innerHTML = sortedClients.map((c, idx) => {
      const pct = totEur > 0 ? ((c.totalEur / totEur) * 100).toFixed(1) : '0.0';
      return `
        <div class="sales-ranking-item">
          <div class="ranking-client-info">
            <div class="ranking-client-name">${idx + 1}. ${c.name}</div>
            <div class="ranking-client-proj">${c.latestProject} • ${c.ordersCount} ${c.ordersCount === 1 ? 'comandă' : 'comenzi'}</div>
          </div>
          <div class="ranking-bar-wrap">
            <div class="ranking-bar-bg">
              <div class="ranking-bar-fill" style="width: ${pct}%;"></div>
            </div>
            <div class="ranking-bar-pct">${pct}%</div>
          </div>
          <div class="ranking-val-box">
            <div class="ranking-val-eur">${c.totalEur.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
            <div class="ranking-val-ron">${c.totalRon.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. Render CRM Orders Table
  renderDashOrdersTable();
}

function renderDashOrdersTable() {
  const tbody = document.getElementById('dash-orders-tbody');
  if (!tbody) return;

  const orders = adminState.yearsData.orders || [];
  const search = (document.getElementById('dash-orders-search-input')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('dash-orders-status-filter')?.value || 'ALL';

  const filtered = orders.filter(o => {
    if (statusFilter !== 'ALL') {
      const st = (o.status || 'NOUA').toUpperCase();
      if (statusFilter === 'NOUA' && st !== 'NOUA') return false;
      if (statusFilter === 'IN_PRODUCTIE' && st !== 'IN_PRODUCTIE') return false;
      if (statusFilter === 'GATA_LIVRARE' && st !== 'GATA_LIVRARE') return false;
      if (statusFilter === 'FINALIZATA' && st !== 'FINALIZATA' && st !== 'CONFIRMED') return false;
    }
    if (search) {
      const matchClient = (o.client || '').toLowerCase().includes(search);
      const matchProject = (o.project || '').toLowerCase().includes(search);
      const matchNumber = (o.orderNumber || o.id || '').toLowerCase().includes(search);
      return matchClient || matchProject || matchNumber;
    }
    return true;
  });

  const countBadge = document.getElementById('dash-orders-table-count');
  if (countBadge) countBadge.textContent = `${filtered.length} DIN ${orders.length} COMENZI`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 24px;">Nicio comandă găsită conform filtrelor selectate.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach((o, idx) => {
    const tr = document.createElement('tr');
    const orderIndexInAll = orders.indexOf(o);

    const st = (o.status || 'NOUA').toUpperCase();
    let badgeClass = 'status-badge-noua';
    if (st === 'IN_PRODUCTIE') badgeClass = 'status-badge-in_productie';
    else if (st === 'GATA_LIVRARE') badgeClass = 'status-badge-gata_livrare';
    else if (st === 'FINALIZATA' || st === 'CONFIRMED') badgeClass = 'status-badge-finalizata';

    tr.innerHTML = `
      <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
      <td>
        <strong style="color: var(--kronvent-blue); font-weight: 700; font-size: 12.5px; letter-spacing: -0.01em;">${o.orderNumber || o.id}</strong>
      </td>
      <td style="text-align: center; font-size: 11.5px; color: var(--text-secondary);">${o.date || '-'}</td>
      <td style="font-weight: 600; color: var(--text-main); font-size: 12.5px;">${o.client || 'Client B2B'}</td>
      <td style="color: var(--text-secondary); font-size: 12px;">${o.project || 'Proiect Standard'}</td>
      <td style="text-align: right; font-weight: 600; font-size: 12px;">${o.totalMp ? o.totalMp.toFixed(2) : '0.00'} m²</td>
      <td style="text-align: right; font-size: 12px;">${o.totalPiese || 0} buc</td>
      <td style="text-align: right; font-weight: 700; color: var(--industrial-green); font-size: 12.5px;">${o.totalEur ? o.totalEur.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} €</td>
      <td style="text-align: right; font-weight: 600; color: var(--text-main); font-size: 12px;">${o.totalRon ? o.totalRon.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} RON</td>
      <td style="text-align: center;">
        <select class="dash-order-status-dropdown ${badgeClass}" onchange="handleOrderStatusChange('${o.id}', this.value)">
          <option value="NOUA" ${st === 'NOUA' ? 'selected' : ''}>Ofertă Nouă</option>
          <option value="IN_PRODUCTIE" ${st === 'IN_PRODUCTIE' ? 'selected' : ''}>În Producție</option>
          <option value="GATA_LIVRARE" ${st === 'GATA_LIVRARE' ? 'selected' : ''}>Gata de Livrare</option>
          <option value="FINALIZATA" ${(st === 'FINALIZATA' || st === 'CONFIRMED') ? 'selected' : ''}>Finalizată</option>
        </select>
      </td>
      <td style="text-align: center; white-space: nowrap;">
        <div style="display: inline-flex; gap: 6px;">
          <button class="k-btn k-btn-secondary k-btn-sm" style="padding: 4px 8px; font-size: 11px;" onclick="inspectOrderSnapshot(${orderIndexInAll})" title="Vizualizează parametrii tehnici și snapshot-ul de calcul">
            <svg class="icon-svg" viewBox="0 0 24 24" style="width: 13px; height: 13px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <span>Snapshot</span>
          </button>
          <button class="k-btn k-btn-primary k-btn-sm" style="padding: 4px 8px; font-size: 11px;" onclick="loadOrderIntoCentralizer('${o.id}')" title="Comută în editor">
            <svg class="icon-svg" viewBox="0 0 24 24" style="width: 13px; height: 13px;"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            <span>Deschide</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.handleOrderStatusChange = async function(orderId, newStatus) {
  try {
    const res = await fetch('/api/orders/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: newStatus })
    });
    if (res.ok) {
      const order = (adminState.yearsData.orders || []).find(o => o.id === orderId || o.orderNumber === orderId);
      if (order) order.status = newStatus;
      renderAdminDashboard();
      showToast(`Statusul comenzii ${orderId} a fost actualizat la "${newStatus}"!`, 'success');
    } else {
      showToast('Eroare la actualizarea statusului comenzii.', 'error');
    }
  } catch (err) {
    showToast('Eroare rețea: ' + err.message, 'error');
  }
};

window.loadOrderIntoCentralizer = function(orderId) {
  const order = (adminState.yearsData.orders || []).find(o => o.id === orderId || o.orderNumber === orderId);
  if (!order) return;

  showToast(`Comanda ${order.orderNumber || order.id} (${order.client}) este activă în Nomenclator!`, 'info');
  const tabComenzi = document.querySelector('.admin-tab-btn[data-target="admin-tab-comenzi"]');
  if (tabComenzi) tabComenzi.click();
};

function exportOrdersReportExcel() {
  const orders = adminState.yearsData.orders || [];
  if (orders.length === 0) {
    showToast('Nu există comenzi de exportat.', 'warning');
    return;
  }

  const cursEur = adminState.settings.cursEur || 5.2542;
  const rows = [
    ['KRONVENT BRAȘOV - RAPORT VÂNZĂRI & COMENZI CLIENȚI HVAC'],
    [`Generat la data: ${new Date().toLocaleString('ro-RO')} | Curs BNR de referință: 1 EUR = ${cursEur.toFixed(4)} RON`],
    [''],
    [
      'Nr. Crt.',
      'Nr. Comandă',
      'An',
      'Dată',
      'Beneficiar (Client B2B)',
      'Obiectiv / Proiect HVAC',
      'Suprafață (m²)',
      'Piese (buc)',
      'Valoare fără TVA (EUR)',
      'Valoare fără TVA (RON)',
      'TVA 21% (RON)',
      'Total cu TVA (RON)',
      'Status Fabricație'
    ]
  ];

  let sumEur = 0;
  let sumRon = 0;
  let sumMp = 0;
  let sumPiese = 0;

  orders.forEach((o, idx) => {
    const valEur = o.totalEur || 0;
    const valRon = o.totalRon || (valEur * cursEur);
    const tvaRon = valRon * 0.21;
    const totTvaRon = valRon + tvaRon;
    const mp = o.totalMp || 0;
    const piese = o.totalPiese || 0;

    sumEur += valEur;
    sumRon += valRon;
    sumMp += mp;
    sumPiese += piese;

    let statusText = o.status;
    if (o.status === 'NOUA') statusText = 'Ofertă Nouă';
    else if (o.status === 'IN_PRODUCTIE') statusText = 'În Producție';
    else if (o.status === 'GATA_LIVRARE') statusText = 'Gata de Livrare';
    else if (o.status === 'FINALIZATA' || o.status === 'CONFIRMED') statusText = 'Finalizată & Facturată';

    rows.push([
      idx + 1,
      o.orderNumber || o.id,
      o.year || 2026,
      o.date || '-',
      o.client || 'Client B2B',
      o.project || 'Proiect HVAC',
      parseFloat(mp.toFixed(2)),
      piese,
      parseFloat(valEur.toFixed(2)),
      parseFloat(valRon.toFixed(2)),
      parseFloat(tvaRon.toFixed(2)),
      parseFloat(totTvaRon.toFixed(2)),
      statusText
    ]);
  });

  const totalTvaRon = sumRon * 0.21;
  rows.push(['']);
  rows.push([
    'TOTALURI:',
    '',
    '',
    '',
    '',
    `${orders.length} comenzi`,
    parseFloat(sumMp.toFixed(2)),
    sumPiese,
    parseFloat(sumEur.toFixed(2)),
    parseFloat(sumRon.toFixed(2)),
    parseFloat(totalTvaRon.toFixed(2)),
    parseFloat((sumRon + totalTvaRon).toFixed(2)),
    'RAPORT FINAL'
  ]);

  if (window.XLSX) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 8 },
      { wch: 12 },
      { wch: 28 },
      { wch: 36 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 20 },
      { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Rapoarte Vanzari');
    XLSX.writeFile(wb, `KronVent_Raport_Vanzari_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Raportul de vânzări a fost descărcat cu succes!', 'success');
  } else {
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(";")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KronVent_Raport_Vanzari_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Raportul a fost exportat ca fișier CSV!', 'success');
  }
}

function exportMaterialsReportExcel() {
  const items = adminState.items || [];
  const orders = adminState.yearsData.orders || [];
  
  let totSup = 0;
  items.forEach(it => {
    totSup += parseFloat(it.suprafata) || 0;
  });

  const ordersVolume = orders.reduce((acc, o) => acc + (o.totalMp || 0), 0);
  const activeMp = ordersVolume > 0 ? ordersVolume : (totSup || 2392.93);

  const rows = [
    ['KRONVENT BRAȘOV - BALANȚĂ MATERIALE & CONSUM FABRICAȚIE TABLĂ'],
    [`Generat la data: ${new Date().toLocaleString('ro-RO')} | Tablă zincată DX51D + Z275 (SR EN 10346)`],
    [''],
    ['Cod Material / Consumabil', 'Denumire Material', 'Grosime / Dimensiune', 'U.M.', 'Cantitate Estimată', 'Greutate (kg)', 'Destinație Atelier'],
    ['TAB-06', 'Tablă zincată DX51D + Z275 în rulou', '0.6 mm (laturi <= 500mm)', 'm²', parseFloat((activeMp * 0.28).toFixed(2)), parseFloat((activeMp * 0.28 * 4.71).toFixed(1)), 'Debitări Canale & Piese Mici'],
    ['TAB-08', 'Tablă zincată DX51D + Z275 în rulou', '0.8 mm (laturi 501-1000mm)', 'm²', parseFloat((activeMp * 0.52).toFixed(2)), parseFloat((activeMp * 0.52 * 6.28).toFixed(1)), 'Producție Standard Canale & Coturi'],
    ['TAB-10', 'Tablă zincată DX51D + Z275 în rulou', '1.0 mm (laturi > 1000mm)', 'm²', parseFloat((activeMp * 0.20).toFixed(2)), parseFloat((activeMp * 0.20 * 7.85).toFixed(1)), 'Tronsoane Mari & Camere Plenum'],
    ['FL-20', 'Profil flanșă rectangulară galvanizată', 'F 20 (perimetru <= 3500mm)', 'ml', parseFloat((activeMp * 4.2).toFixed(1)), '-', 'Îmbinări Tronsoane Medii'],
    ['FL-30', 'Profil flanșă rectangulară galvanizată', 'F 30 (perimetru > 3500mm)', 'ml', parseFloat((activeMp * 1.1).toFixed(1)), '-', 'Îmbinări Tronsoane Industriale'],
    ['COLT-20', 'Colțar zincat pentru profil F20', 'Grosime 2.5 mm', 'buc', Math.round(activeMp * 4.2 * 4 / 1.5), '-', 'Rigidizare Colțuri Flanșe'],
    ['COLT-30', 'Colțar zincat pentru profil F30', 'Grosime 3.0 mm', 'buc', Math.round(activeMp * 1.1 * 4 / 1.5), '-', 'Rigidizare Colțuri Flanșe Mari'],
    ['SIL-ACR', 'Mastic / Silicon etanșare HVAC', 'Cartuș 310 ml', 'tub', Math.ceil(activeMp / 18), '-', 'Etanșare Îmbinări Clasă B/C'],
    ['CLIPS', 'Cleme fixare / Clips flanșă', 'Pas 350 mm', 'buc', Math.round(activeMp * 5.3), '-', 'Fixare Tronsoane Rectangulare']
  ];

  if (window.XLSX) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 38 },
      { wch: 28 },
      { wch: 8 },
      { wch: 18 },
      { wch: 16 },
      { wch: 34 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Balanta Materiale');
    XLSX.writeFile(wb, `KronVent_Balanta_Materiale_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Balanța de materiale a fost descărcată cu succes!', 'success');
  }
}

window.activateYearDirectly = async function(year) {
  try {
    const res = await fetch('/api/years/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: parseInt(year, 10) })
    });
    if (res.ok) {
      showToast(`Anul ${year} a fost setat ca An Activ de lucru!`, 'success');
      await loadYearsAndParameters();
    } else {
      showToast('Eroare la activarea anului.', 'error');
    }
  } catch (e) {
    showToast('Eroare rețea: ' + e.message, 'error');
  }
};

window.inspectOrderSnapshot = function(orderIndex) {
  const order = adminState.yearsData.orders[orderIndex];
  if (!order) return;
  openSnapshotModal(order);
};

function openSnapshotModal(order) {
  const modal = document.getElementById('admin-snapshot-modal');
  if (!modal) return;

  const title = document.getElementById('snapshot-modal-title');
  const sub = document.getElementById('snapshot-modal-sub');
  const pills = document.getElementById('snapshot-modal-pills');
  const jsonPre = document.getElementById('snapshot-modal-json');

  if (title) title.textContent = `Snapshot Imuabil Comandă: ${order.orderNumber || order.id}`;
  if (sub) sub.textContent = `Beneficiar: ${order.client} • Proiect: ${order.project} • Dată: ${order.date}`;

  const snap = order.calculation_snapshot || {};
  if (pills) {
    pills.innerHTML = `
      <span class="snapshot-pill">An Audit: ${snap.year || order.year || 2026}</span>
      <span class="snapshot-pill">Curs Snapshot: ${snap.cursEur || snap.settings?.cursEur || 5.2542} RON</span>
      <span class="snapshot-pill">Preț Bază: ${snap.settings?.pretMpRectangular || 15} €/m²</span>
      <span class="snapshot-pill">TVA: ${snap.settings?.tva || 21}%</span>
      <span class="snapshot-pill">Prag Flanșă: ${snap.settings?.flansaPerimeterThreshold || 3500} mm</span>
      <span class="snapshot-pill">Poziții Salvate: ${(order.items || []).length}</span>
    `;
  }

  const cleanSnap = {
    orderNumber: order.orderNumber || order.id,
    year: order.year,
    client: order.client,
    project: order.project,
    date: order.date,
    totalEur: order.totalEur,
    totalRon: order.totalRon,
    totalMp: order.totalMp,
    totalPiese: order.totalPiese,
    calculation_snapshot: snap,
    items: order.items
  };

  if (jsonPre) {
    jsonPre.textContent = JSON.stringify(cleanSnap, null, 2);
  }

  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('open'));
}

function closeSnapshotModal() {
  const modal = document.getElementById('admin-snapshot-modal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 200);
}

async function saveAllSettings() {
  const pretMp = parseFloat(document.getElementById('admin-setting-pret-mp').value) || 15.0;
  const curs = parseFloat(document.getElementById('admin-setting-curs-eur').value) || 5.2542;
  const tva = parseFloat(document.getElementById('admin-setting-tva').value) || 21;
  const flansaPrag = parseFloat(document.getElementById('admin-setting-flansa-prag').value) || 3500;
  const grosimePrag1 = parseFloat(document.getElementById('admin-setting-grosime-prag1').value) || 500;
  const grosimePrag2 = parseFloat(document.getElementById('admin-setting-grosime-prag2').value) || 1000;
  const density06 = parseFloat(document.getElementById('admin-setting-density-06').value) || 4.71;
  const density08 = parseFloat(document.getElementById('admin-setting-density-08').value) || 6.28;
  const density10 = parseFloat(document.getElementById('admin-setting-density-10').value) || 7.85;
  const clipsStep = parseFloat(document.getElementById('admin-setting-clips-step').value) || 350;
  const siliconStep = parseFloat(document.getElementById('admin-setting-silicon-step').value) || 18;

  // Extract Spiro inputs
  const spiroInputs = document.querySelectorAll('.spiro-matrix-input');
  const updatedSpiro = {};
  spiroInputs.forEach(inp => {
    const d = inp.getAttribute('data-d');
    const f = inp.getAttribute('data-f');
    const val = parseFloat(inp.value) || 0;
    if (!updatedSpiro[d]) updatedSpiro[d] = {};
    updatedSpiro[d][f] = val;
  });

  const updatedSettings = {
    pretMpRectangular: pretMp,
    cursEur: curs,
    cursBnrDate: adminState.settings.cursBnrDate || '09.09.2026',
    tva: tva,
    flansaPerimeterThreshold: flansaPrag,
    dimGrosimePrag1: grosimePrag1,
    dimGrosimePrag2: grosimePrag2,
    density06: density06,
    density08: density08,
    density10: density10,
    clipsStep: clipsStep,
    siliconStep: siliconStep
  };

  // Update local state
  Object.assign(adminState.settings, updatedSettings);
  adminState.yearsData.spiroPrices = updatedSpiro;

  // Recalculate rectangular items in active table
  adminState.items.forEach(it => {
    if (it.categorie !== 'Tubulatura Circulara Spiro' && it.suprafata) {
      it.pretUnitar = parseFloat((it.sUnit * pretMp).toFixed(2));
      it.valoareTotala = parseFloat((it.suprafata * pretMp).toFixed(2));
    }
  });

  try {
    const res = await fetch('/api/parameters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: adminState.yearsData.activeYear,
        settings: updatedSettings,
        spiroPrices: updatedSpiro
      })
    });

    if (res.ok) {
      updateAdminMetrics();
      updateAdminAtelierBreakdown();
      renderAdminTable();
      renderYearsTable();
      showToast(`Toate setările tehnologice și matricea Spiro pentru anul ${adminState.yearsData.activeYear} au fost salvate cu succes!`, 'success');
    } else {
      showToast('Eroare la salvarea pe server a parametrilor.', 'error');
    }
  } catch (e) {
    showToast('Eroare rețea: ' + e.message, 'error');
  }
}

function setupYearListeners() {
  // Activate year button
  const btnActivateYear = document.getElementById('admin-btn-activate-year');
  if (btnActivateYear) {
    btnActivateYear.addEventListener('click', async () => {
      const select = document.getElementById('admin-select-active-year');
      if (!select) return;
      const yr = parseInt(select.value, 10);
      await activateYearDirectly(yr);
    });
  }

  // Clone year button
  const btnCloneYear = document.getElementById('admin-btn-clone-year');
  if (btnCloneYear) {
    btnCloneYear.addEventListener('click', async () => {
      const inputNew = document.getElementById('admin-input-new-year');
      const selectClone = document.getElementById('admin-select-clone-from');
      if (!inputNew || !selectClone) return;

      const newYear = parseInt(inputNew.value, 10);
      const cloneFrom = parseInt(selectClone.value, 10);

      if (!newYear || isNaN(newYear) || newYear < 2024 || newYear > 2040) {
        showToast('Vă rugăm să introduceți un an valid (ex: 2027).', 'warning');
        return;
      }

      try {
        btnCloneYear.disabled = true;
        btnCloneYear.textContent = 'Clonare...';

        const res = await fetch('/api/years', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: newYear, cloneFrom: cloneFrom })
        });

        const data = await res.json();
        if (data.success) {
          showToast(`Anul ${newYear} a fost inițializat prin clonare din ${cloneFrom}!`, 'success');
          await loadYearsAndParameters();
        } else {
          showToast('Eroare: ' + (data.error || 'Nu s-a putut inițializa anul.'), 'error');
        }
      } catch (e) {
        showToast('Eroare rețea: ' + e.message, 'error');
      } finally {
        btnCloneYear.disabled = false;
        btnCloneYear.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span>Inițializează An</span>`;
      }
    });
  }

  // Save all settings & spiro button
  const btnSaveAll = document.getElementById('admin-btn-save-all-settings');
  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', saveAllSettings);
  }

  // Modal close buttons
  const modalCloseBtn = document.getElementById('snapshot-modal-close-btn');
  const modalOkBtn = document.getElementById('snapshot-modal-ok-btn');
  const modalOverlay = document.getElementById('admin-snapshot-modal');
  const copyBtn = document.getElementById('snapshot-modal-copy-btn');

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeSnapshotModal);
  if (modalOkBtn) modalOkBtn.addEventListener('click', closeSnapshotModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeSnapshotModal();
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const jsonPre = document.getElementById('snapshot-modal-json');
      if (jsonPre) {
        navigator.clipboard.writeText(jsonPre.textContent).then(() => {
          showToast('Snapshot-ul JSON a fost copiat în clipboard!', 'success');
        }).catch(() => {
          showToast('Nu s-a putut copia automat.', 'warning');
        });
      }
    });
  }
}

