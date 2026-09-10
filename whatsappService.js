/**
 * KronVent HVAC - Serviciu Integrare WhatsApp & Notificări Grup (UltraGSM)
 * =======================================================================
 * Suportă transmiterea automată a comenzilor pe grupul de producție WhatsApp
 * prin intermediul gateway-ului UltraGSM REST API.
 */

const https = require('https');
const http = require('http');
const url = require('url');

/**
 * Formatează mesajul WhatsApp pentru o comandă nouă
 * @param {Object} order Obiectul comenzii
 * @param {string} trackingUrl Link-ul public de urmărire
 * @returns {string} Mesaj text formatat cu Markdown WhatsApp (*bold*, _italic_, etc.)
 */
function formatOrderWhatsAppMessage(order, trackingUrl) {
  const orderId = order.id || order.orderNumber || 'CMD-NOUĂ';
  const clientName = order.client || 'Client Nespecificat';
  const cui = order.cui ? ` (${order.cui})` : '';
  const project = order.project || 'Proiect Tubulatură HVAC';
  const totalMp = (parseFloat(order.totalMp) || 0).toFixed(2);
  const totalPiese = Math.round(parseFloat(order.totalPiese) || 0);
  const totalEur = (parseFloat(order.totalEur) || 0).toFixed(2);
  const totalRon = (parseFloat(order.totalRon) || 0).toFixed(2);
  const dateStr = order.date || new Date().toLocaleDateString('ro-RO');
  const contactTel = order.telefon || order.contactTel || '-';

  // Calcul greutate estimată dacă există items
  let totalKg = 0;
  if (Array.isArray(order.items)) {
    totalKg = order.items.reduce((acc, it) => acc + (parseFloat(it.greutate) || 0), 0);
  }

  return `*COMANDĂ NOUĂ KRONVENT HVAC*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• *Nr. Comandă:* ${orderId}\n` +
    `• *Data Înregistrării:* ${dateStr}\n` +
    `• *Beneficiar:* ${clientName}${cui}\n` +
    `• *Proiect / Șantier:* ${project}\n` +
    `• *Telefon Contact:* ${contactTel}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `*SPECIFICAȚIE PRODUCȚIE:*\n` +
    `• Nr. Repere / Piese: *${totalPiese} buc*\n` +
    `• Suprafață Tablă: *${totalMp} m²*\n` +
    (totalKg > 0 ? `• Masă Tablă Estimată: *${totalKg.toFixed(1)} kg*\n` : '') +
    `• *Valoare Totală:* *${totalEur} €* (${totalRon} RON)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• *Status Curent:* Preluată în Producție\n` +
    `• *LINK URMĂRIRE LIVE CLIENT & ATELIER:*\n` +
    `${trackingUrl}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_KronVent Brașov • Sistem Automat Notificări Fabricație_`;
}

/**
 * Formatează mesajul WhatsApp pentru actualizarea stadiului unei comenzi
 * @param {Object} order Obiectul comenzii
 * @param {string} newStatus Denumirea noului status
 * @param {string} dataEstimata Data estimată de finalizare
 * @param {string} nota Nota adăugată de atelier
 * @param {string} trackingUrl Link-ul de urmărire
 * @returns {string} Mesaj formatat
 */
function formatStatusUpdateWhatsAppMessage(order, newStatus, dataEstimata, nota, trackingUrl) {
  const orderId = order.id || order.orderNumber || 'CMD';
  const clientName = order.client || 'Client';

  return `*ACTUALIZARE STADIU COMANDĂ*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• *Comanda:* ${orderId} (${clientName})\n` +
    `• *Stadiu Nou:* *${newStatus}*\n` +
    (dataEstimata ? `• *Dată Estimată Finalizare:* *${dataEstimata}*\n` : '') +
    (nota ? `• *Notă Tehnică Atelier:* _"${nota}"_\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• *Vezi Fișa Live a Comenzii:*\n` +
    `${trackingUrl}\n` +
    `_KronVent Brașov • Dispecerat Producție_`;
}

/**
 * Trimite cerere HTTP/HTTPS către gateway-ul UltraGSM
 * @param {string} endpointUrl URL-ul API UltraGSM
 * @param {Object} payload Datele trimise
 * @returns {Promise<Object>} Răspunsul primit de la API
 */
function postJsonRequest(endpointUrl, payload) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = url.parse(endpointUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const postData = JSON.stringify(payload);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path || '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'KronVent-HVAC-Engine/2.0'
        },
        timeout: 10000 // 10 secunde timeout
      };

      const req = lib.request(options, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          let parsedBody = body;
          try {
            parsedBody = JSON.parse(body);
          } catch (e) {
            // Rămâne text simplu
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: parsedBody });
          } else {
            resolve({ statusCode: res.statusCode, error: true, data: parsedBody });
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('UltraGSM API request timeout (10s)'));
      });

      req.write(postData);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Trimite mesaj WhatsApp prin UltraGSM
 * @param {Object} config Setări UltraGSM { enabled, apiKey, groupId, endpointUrl }
 * @param {string} message Textul mesajului
 * @returns {Promise<Object>} Rezultat expediere
 */
async function sendUltraGsmMessage(config, message) {
  const enabled = config && config.enabled !== false;
  const apiKey = config?.apiKey?.trim() || '';
  const destination = config?.groupId?.trim() || config?.phone?.trim() || '';
  const endpoint = config?.endpointUrl?.trim() || 'https://api.ultragsm.com/send';

  if (!enabled) {
    console.log('[UltraGSM WhatsApp] Notificările automate sunt dezactivate din setări.');
    return { success: false, skipped: true, reason: 'disabled_in_settings' };
  }

  // Verificare dacă avem configurat un apiKey sau destinație reală
  if (!apiKey || !destination) {
    console.log('[UltraGSM WhatsApp Simulator] Parametrii UltraGSM nu sunt complet setați (lipsește API Key sau Grup ID). Mesajul a fost simulat cu succes:\n' + message);
    return {
      success: true,
      simulated: true,
      reason: 'missing_credentials_simulated',
      messagePreview: message
    };
  }

  // Structură standard conform API-urilor UltraGSM / Gateway WhatsApp
  const payload = {
    apiKey: apiKey,
    token: apiKey,
    to: destination,
    group: destination,
    message: message,
    text: message
  };

  try {
    const res = await postJsonRequest(endpoint, payload);
    console.log('[UltraGSM WhatsApp] Mesaj expediat către UltraGSM:', res);
    return {
      success: !res.error,
      statusCode: res.statusCode,
      response: res.data
    };
  } catch (err) {
    console.error('[UltraGSM WhatsApp Error] Eroare conexiune gateway:', err.message);
    // Nu aruncăm eroare fatală pentru a nu bloca fluxul comenzii
    return {
      success: false,
      error: err.message,
      simulatedFallback: true
    };
  }
}

/**
 * Trimite un mesaj de test din panoul de administrare
 * @param {Object} config Setările introduse de administrator
 * @returns {Promise<Object>}
 */
async function testWhatsAppConnection(config) {
  const testMsg = `*TEST NOTIFICARE WHATSAPP KRONVENT HVAC*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Conexiunea între aplicația de producție KronVent și UltraGSM este activă!\n` +
    `Data & Ora testului: ${new Date().toLocaleString('ro-RO')}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Test inițiat din Panoul de Administrare Fabrică._`;

  return await sendUltraGsmMessage(config, testMsg);
}

module.exports = {
  formatOrderWhatsAppMessage,
  formatStatusUpdateWhatsAppMessage,
  sendUltraGsmMessage,
  testWhatsAppConnection
};
