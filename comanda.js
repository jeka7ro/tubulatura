/**
 * KronVent HVAC - Portal Live Urmărire Comandă Client & Atelier
 * ==============================================================
 */

(function () {
  'use strict';

  // Stadii de fabricație în ordine secvențială
  const STAGES = [
    { key: 'inregistrata', label: 'Înregistrată', progress: 10, icon: '' },
    { key: 'preluata', label: 'Preluată în Producție', progress: 25, icon: '' },
    { key: 'debitare', label: 'În Debitare CNC', progress: 48, icon: '' },
    { key: 'asamblare', label: 'Asamblare & Etanșare', progress: 72, icon: '' },
    { key: 'calitate', label: 'Control Calitate (QC)', progress: 88, icon: '' },
    { key: 'gata', label: 'Gata de Livrare', progress: 100, icon: '' },
    { key: 'livrata', label: 'Livrată / Finalizată', progress: 100, icon: '' }
  ];

  let currentOrder = null;

  // 1. Initializare Temă (Dark / Light)
  function initTheme() {
    const savedTheme = localStorage.getItem('kronvent_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('kronvent_theme', next);
      });
    }
  }

  // 2. Parsare ID Comandă din URL
  function getOrderIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    if (!id) {
      // Posibil format /comanda.html#CMD-... sau ultimul segment
      const hash = window.location.hash.replace('#', '').trim();
      if (hash) id = hash;
    }
    return id;
  }

  // 3. Preluare Date Comandă de la Server
  async function fetchOrderData(orderId) {
    if (!orderId) {
      showErrorState('Nu a fost specificat niciun număr de comandă în link.');
      return;
    }

    try {
      const resp = await fetch(`/api/orders?id=${encodeURIComponent(orderId)}`, {
        cache: 'no-store'
      });
      if (!resp.ok) {
        throw new Error(`Comanda cu numărul "${orderId}" nu a fost găsită în baza de date.`);
      }
      const resData = await resp.json();
      if (resData && resData.order) {
        currentOrder = resData.order;
        renderOrderDetails(currentOrder);
      } else {
        throw new Error('Răspuns invalid primit de la server.');
      }
    } catch (err) {
      console.error('Eroare la preluarea comenzii:', err);
      showErrorState(err.message);
    }
  }

  // 4. Randare Date Comandă în Pagină
  function renderOrderDetails(order) {
    const orderId = order.id || order.orderNumber || 'CMD-NESPECIFICAT';
    document.title = `Comanda ${orderId} - Urmărire Producție KronVent`;

    // Titlu & Badges
    const labelOrderId = document.getElementById('label-order-id');
    if (labelOrderId) labelOrderId.textContent = orderId;

    // Status curent și Progres Stepper
    updateProductionStepper(order.status || 'preluata');

    // Termen estimat livrare
    const deliveryElem = document.getElementById('text-delivery-date');
    if (deliveryElem) {
      deliveryElem.textContent = order.dataEstimataLivrare || 'În curs de programare';
    }

    // Beneficiar & Livrare
    const clientElem = document.getElementById('info-client');
    if (clientElem) clientElem.textContent = order.client || 'Beneficiar Nespecificat';

    const cuiElem = document.getElementById('info-cui');
    if (cuiElem) cuiElem.textContent = order.cui || 'Persoană Fizică / Fără CUI';

    const projElem = document.getElementById('info-project');
    if (projElem) projElem.textContent = order.project || 'Proiect Standard HVAC';

    const telElem = document.getElementById('info-telefon');
    if (telElem) telElem.textContent = order.telefon || order.contactTel || '-';

    const dateElem = document.getElementById('info-date');
    if (dateElem) dateElem.textContent = order.date || '-';

    // Jurnal Atelier (Timeline)
    renderTimeline(order);

    // Tabel Repere & Piese
    renderItemsTable(order.items || []);

    // Centralizator Cantități & Finaciar
    renderFinancialSummary(order);

    // Butoane de partajare
    setupActionButtons(order);
  }

  // 5. Stepper Producție
  function updateProductionStepper(rawStatus) {
    const statusKey = (rawStatus || 'preluata').toLowerCase();
    
    // Identificare index în lista STAGES
    let stageIndex = STAGES.findIndex(s => s.key === statusKey);
    if (stageIndex === -1) {
      // Fallback
      stageIndex = 1; // preluata
    }

    const currentStage = STAGES[stageIndex];

    // Actualizare Hero Banner
    const iconElem = document.getElementById('badge-status-icon');
    const textElem = document.getElementById('badge-status-text');
    if (iconElem) iconElem.textContent = currentStage.icon;
    if (textElem) textElem.textContent = currentStage.label;

    // Linia de progres
    const progressLine = document.getElementById('stepper-progress-line');
    if (progressLine) {
      progressLine.style.width = `${currentStage.progress}%`;
    }

    // Nodurile de pe stepper
    const stageNodes = [
      { id: 'step-node-inregistrata', idx: 0 },
      { id: 'step-node-preluata', idx: 1 },
      { id: 'step-node-debitare', idx: 2 },
      { id: 'step-node-asamblare', idx: 3 },
      { id: 'step-node-calitate', idx: 4 },
      { id: 'step-node-gata', idx: 5 }
    ];

    stageNodes.forEach(nodeInfo => {
      const el = document.getElementById(nodeInfo.id);
      if (!el) return;
      el.classList.remove('completed', 'current');
      
      if (nodeInfo.idx < stageIndex) {
        el.classList.add('completed');
      } else if (nodeInfo.idx === stageIndex || (nodeInfo.idx === 5 && stageIndex >= 5)) {
        el.classList.add('current');
      }
    });
  }

  // 6. Jurnal Producție
  function renderTimeline(order) {
    const container = document.getElementById('tracking-timeline-container');
    if (!container) return;

    const timeline = Array.isArray(order.timeline) && order.timeline.length > 0
      ? order.timeline
      : [
          {
            status: order.status || 'preluata',
            title: 'Preluată în Producție',
            date: order.date || new Date().toISOString(),
            note: 'Comandă înregistrată în fluxul atelierului KronVent.'
          }
        ];

    // Afișăm ordonat descrescător (cel mai recent update primul)
    const reversed = [...timeline].reverse();

    container.innerHTML = reversed.map((item, idx) => {
      let formattedDate = item.date || '';
      try {
        if (item.date && item.date.includes('T')) {
          const d = new Date(item.date);
          formattedDate = d.toLocaleString('ro-RO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (e) {
        // Fallback la text original
      }

      return `
        <li class="timeline-item">
          <div class="timeline-bullet"></div>
          <div class="timeline-title">${escapeHtml(item.title || 'Actualizare Producție')}</div>
          <div class="timeline-date">${escapeHtml(formattedDate)}</div>
          ${item.note ? `<div class="timeline-note">${escapeHtml(item.note)}</div>` : ''}
        </li>
      `;
    }).join('');
  }

  // 7. Tabel Repere & Piese
  function renderItemsTable(items) {
    const tbody = document.getElementById('tracking-items-tbody');
    const countElem = document.getElementById('count-total-piese');
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">Nu există repere detaliate pentru această comandă.</td></tr>`;
      if (countElem) countElem.textContent = '0';
      return;
    }

    let totalPieseCount = 0;

    tbody.innerHTML = items.map((it, idx) => {
      const cant = parseInt(it.cantitate || it.cant || 1, 10);
      totalPieseCount += cant;

      const code = it.cod || it.code || `R${idx + 1}`;
      const name = it.denumire || it.name || it.tip || 'Tubulatură Rectangulară';
      
      // Construire text dimensiuni
      let dims = '-';
      if (it.laturaA || it.laturaB || it.lungime) {
        dims = `${it.laturaA || 0} × ${it.laturaB || 0}${it.lungime ? ` L=${it.lungime}` : ''}`;
      } else if (it.dimensiuni) {
        dims = it.dimensiuni;
      }

      const mp = (parseFloat(it.suprafataTotala || it.suprafata || 0)).toFixed(2);
      const kg = (parseFloat(it.greutateTotala || it.greutate || 0)).toFixed(1);
      const pretEur = (parseFloat(it.valoareTotala || it.pretTotalEur || it.pretEur || ((parseFloat(it.pretUnitar) || 0) * cant) || 0)).toFixed(2);

      return `
        <tr>
          <td style="color: var(--text-muted); font-weight: 700;">${idx + 1}</td>
          <td>
            <strong style="color: var(--text-main); display: block;">${escapeHtml(name)}</strong>
            <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(code)}</span>
          </td>
          <td><code style="font-size: 12px; background: var(--bg-card-hover); padding: 2px 6px; border-radius: 4px;">${escapeHtml(dims)}</code></td>
          <td style="text-align: center; font-weight: 700;">${cant} buc</td>
          <td style="text-align: right; font-weight: 600;">${mp} m²</td>
          <td style="text-align: right; color: var(--text-muted);">${kg} kg</td>
          <td style="text-align: right; font-weight: 800; color: var(--industrial-green);">${pretEur} €</td>
        </tr>
      `;
    }).join('');

    if (countElem) countElem.textContent = String(totalPieseCount);
  }

  // 8. Centralizator Cantități & Financiar
  function renderFinancialSummary(order) {
    const countTotal = order.totalPiese || (Array.isArray(order.items) ? order.items.reduce((s, x) => s + (parseInt(x.cantitate || x.cant || 1, 10)), 0) : 0);
    const sumPiese = document.getElementById('sum-piese');
    if (sumPiese) sumPiese.textContent = `${countTotal} buc`;

    const totalMpVal = order.totalMp || (Array.isArray(order.items) ? order.items.reduce((s, x) => s + (parseFloat(x.suprafataTotala || x.suprafata || 0)), 0) : 0);
    const sumMp = document.getElementById('sum-mp');
    if (sumMp) sumMp.textContent = `${parseFloat(totalMpVal).toFixed(2)} m²`;

    // Calcul masă estimată dacă nu e stocată direct
    let totalKg = 0;
    if (Array.isArray(order.items)) {
      totalKg = order.items.reduce((acc, it) => acc + (parseFloat(it.greutateTotala || it.greutate || 0)), 0);
    }
    const sumKg = document.getElementById('sum-kg');
    if (sumKg) sumKg.textContent = `${totalKg.toFixed(1)} kg`;

    const cursVal = order.calculation_snapshot?.cursEur || order.cursEur || 5.2537;
    const sumCurs = document.getElementById('sum-curs');
    if (sumCurs) sumCurs.textContent = `${parseFloat(cursVal).toFixed(4)} RON`;

    const itemsSumEur = Array.isArray(order.items) ? order.items.reduce((s, x) => s + (parseFloat(x.valoareTotala || x.pretTotalEur || x.pretEur || 0)), 0) : 0;
    const taxableEur = parseFloat(order.taxableBaseEur || order.subtotalEur || (order.totalEur ? order.totalEur / 1.21 : itemsSumEur));
    const tvaEur = parseFloat(order.tvaValEur || (order.totalEur ? order.totalEur - taxableEur : (taxableEur * 0.21)));
    const totalEur = parseFloat(order.totalEur || (taxableEur + tvaEur) || itemsSumEur || 0);
    const totalRon = parseFloat(order.totalRon || (totalEur * cursVal));

    const sumTaxable = document.getElementById('sum-taxable-eur');
    if (sumTaxable) sumTaxable.textContent = `${taxableEur.toFixed(2)} €`;

    const sumTva = document.getElementById('sum-tva-eur');
    if (sumTva) sumTva.textContent = `${tvaEur.toFixed(2)} €`;

    const sumTotalEur = document.getElementById('sum-total-eur');
    if (sumTotalEur) sumTotalEur.textContent = `${totalEur.toFixed(2)} €`;

    const sumTotalRon = document.getElementById('sum-total-ron');
    if (sumTotalRon) sumTotalRon.textContent = `echivalent ${totalRon.toFixed(2)} RON (cu TVA inclus)`;
  }

  // 9. Butoane de acțiune & Partajare
  function setupActionButtons(order) {
    const shareUrl = window.location.href;
    const orderId = order.id || order.orderNumber || 'Comandă';

    // Copiere Link
    const copyBtn = document.getElementById('btn-copy-tracking-link');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
          const orig = copyBtn.innerHTML;
          copyBtn.innerHTML = `Link Copiat!`;
          setTimeout(() => { copyBtn.innerHTML = orig; }, 2500);
        }).catch(() => {
          prompt('Copiază adresa link-ului de urmărire:', shareUrl);
        });
      };
    }

    // WhatsApp Share Link
    const waShareBtn = document.getElementById('btn-share-whatsapp');
    if (waShareBtn) {
      const waText = `Bună ziua! Urmăresc comanda mea de tubulatură HVAC KronVent (${orderId}):\n${shareUrl}`;
      waShareBtn.href = `https://wa.me/?text=${encodeURIComponent(waText)}`;
    }
  }

  // 10. Afișare Eroare
  function showErrorState(message) {
    const main = document.querySelector('.tracking-page-container');
    if (main) {
      main.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: var(--bg-card); border: 1px solid var(--border-main); border-radius: var(--radius-lg); margin-top: 40px; box-shadow: var(--shadow-md);">
          <div style="margin-bottom: 16px;"><svg class="icon-svg" viewBox="0 0 24 24" style="width: 48px; height: 48px; stroke: var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
          <h1 style="font-size: 22px; font-weight: 800; color: var(--text-main); margin-bottom: 10px;">Comanda nu a putut fi găsită</h1>
          <p style="color: var(--text-muted); font-size: 14px; max-width: 500px; margin: 0 auto 24px;">${escapeHtml(message)}</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <a href="index.html" class="back-btn-pill" style="padding: 10px 20px;">Înapoi la Catalog Oferte</a>
            <a href="admin.html" class="back-btn-pill" style="padding: 10px 20px;">Panou Administrare Fabrică</a>
          </div>
        </div>
      `;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 11. Start App
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    const orderId = getOrderIdFromUrl();
    fetchOrderData(orderId);

    // Polling automat la 25 de secunde pentru actualizare automată în timp real
    setInterval(() => {
      if (orderId && !document.hidden) {
        fetchOrderData(orderId);
      }
    }, 25000);
  });

})();
