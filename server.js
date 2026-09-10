const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.PORT, 10) || 5181;
const DATA_FILE = path.join(__dirname, 'tubulatura_saved_data.json');
const INITIAL_DATA_FILE = path.join(__dirname, 'tubulatura_initial_data.json');
const YEARS_DATA_FILE = path.join(__dirname, 'tubulatura_years_data.json');

// Supabase / PostgreSQL Integration
let pgPool = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log('[DATABASE] Inițializare conexiune PostgreSQL (Supabase)...');
    
    // Auto-create storage table and load state
    pgPool.query(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `).then(() => {
      console.log('[DATABASE] Tabel kv_store verificat/creat cu succes.');
      return pgPool.query("SELECT data FROM kv_store WHERE key = 'years_data'");
    }).then(res => {
      if (res.rows && res.rows.length > 0 && res.rows[0].data) {
        fs.writeFileSync(YEARS_DATA_FILE, JSON.stringify(res.rows[0].data, null, 2), 'utf-8');
        console.log('[DATABASE] Datele au fost restaurate din Supabase PostgreSQL în fișierul local.');
      } else if (fs.existsSync(YEARS_DATA_FILE)) {
        const localData = JSON.parse(fs.readFileSync(YEARS_DATA_FILE, 'utf-8'));
        return pgPool.query("INSERT INTO kv_store (key, data) VALUES ('years_data', $1) ON CONFLICT (key) DO UPDATE SET data = $1", [localData])
          .then(() => console.log('[DATABASE] Datele inițiale au fost migrate în Supabase PostgreSQL!'));
      }
    }).catch(err => {
      console.error('[DATABASE ERROR] Eroare la inițializarea Supabase:', err.message);
    });
  } catch (e) {
    console.error('[DATABASE ERROR] Modulul pg nu a putut fi încărcat:', e.message);
  }
}

// BNR Live Exchange Rate Cache (30 min TTL)
let bnrCache = null;
let bnrLastFetch = 0;

function fetchBnrRates() {
  return new Promise((resolve) => {
    const now = Date.now();
    if (bnrCache && (now - bnrLastFetch < 30 * 60 * 1000)) {
      return resolve(bnrCache);
    }

    https.get('https://curs.bnr.ro/nbrfxrates.xml', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const cubeMatch = data.match(/<Cube date="([^"]+)">/);
          const dateStr = cubeMatch ? cubeMatch[1] : new Date().toISOString().slice(0, 10);
          const eurMatch = data.match(/<Rate currency="EUR">([0-9.]+)<\/Rate>/);
          const eurRate = eurMatch ? parseFloat(eurMatch[1]) : 5.2542;
          const parts = dateStr.split('-');
          const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;

          bnrCache = {
            success: true,
            currency: 'EUR',
            rate: eurRate,
            date: formattedDate,
            rawDate: dateStr,
            source: 'Banca Națională a României (curs.bnr.ro)'
          };
          bnrLastFetch = now;
          console.log(`[BNR SYNC] Curs EUR actualizat: 1 EUR = ${eurRate} RON la data ${formattedDate}`);
          resolve(bnrCache);
        } catch (e) {
          console.error('[BNR ERROR] Eroare parsare BNR XML:', e.message);
          resolve(getFallbackBnr());
        }
      });
    }).on('error', (err) => {
      console.error('[BNR ERROR] Eroare conectare curs.bnr.ro:', err.message);
      resolve(getFallbackBnr());
    });
  });
}

function getFallbackBnr() {
  return {
    success: true,
    currency: 'EUR',
    rate: 5.2542,
    date: '09.09.2026',
    rawDate: '2026-09-09',
    source: 'Banca Națională a României'
  };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function getProjectData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Eroare la citirea datelor salvate, se folosesc datele inițiale:', e.message);
    }
  }
  if (fs.existsSync(INITIAL_DATA_FILE)) {
    const content = fs.readFileSync(INITIAL_DATA_FILE, 'utf-8');
    return JSON.parse(content);
  }
  return { meta: {}, items: [] };
}

function saveProjectData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS & No-Cache headers for live updates
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname === '/api/data') {
    if (req.method === 'GET') {
      const data = getProjectData();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          saveProjectData(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, message: 'Datele au fost salvate cu succes!' }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/reset' && req.method === 'POST') {
    if (fs.existsSync(INITIAL_DATA_FILE)) {
      const initial = fs.readFileSync(INITIAL_DATA_FILE, 'utf-8');
      fs.writeFileSync(DATA_FILE, initial, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: 'Datele au fost resetate la starea inițială din Excel!' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Fișierul inițial nu există' }));
    }
    return;
  }

  if (pathname === '/api/bnr') {
    fetchBnrRates().then(rates => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(rates));
    }).catch(err => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(getFallbackBnr()));
    });
    return;
  }

  // ====================================================================
  // ANAF WEB SERVICES V9 (VERIFICARE DATE FISCALE & COMPANII CUI)
  // ====================================================================
  function fetchAnafCompany(cui) {
    return new Promise((resolve, reject) => {
      const cleanCui = parseInt(String(cui).replace(/[^0-9]/g, ''), 10);
      if (!cleanCui || isNaN(cleanCui)) {
        return reject(new Error('CUI invalid. Introduceți doar cifre (ex: 14399840).'));
      }

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const postData = JSON.stringify([{ cui: cleanCui, data: dateStr }]);

      const options = {
        hostname: 'webservicesp.anaf.ro',
        port: 443,
        path: '/api/PlatitorTvaRest/v9/tva',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'KronVent-HVAC-Platform/1.0'
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.found && json.found.length > 0) {
              const comp = json.found[0];
              const dg = comp.date_generale || {};
              const tva = comp.inregistrare_scop_Tva || {};
              const sediu = comp.adresa_sediu_social || {};
              const dom = comp.adresa_domiciliu_fiscal || {};

              let fullAddress = (dg.adresa || '').trim();
              if (!fullAddress && sediu.sdenumire_Localitate) {
                const parts = [
                  sediu.sdenumire_Strada ? `${sediu.sdenumire_Strada} ${sediu.snumar_Strada || ''}` : '',
                  sediu.sdetalii_Adresa || '',
                  sediu.sdenumire_Localitate || '',
                  sediu.sdenumire_Judet || ''
                ].filter(Boolean);
                fullAddress = parts.join(', ');
              }

              resolve({
                success: true,
                cui: dg.cui || cleanCui,
                denumire: (dg.denumire || '').trim(),
                adresa: fullAddress,
                nrRegCom: (dg.nrRegCom || '').trim(),
                telefon: (dg.telefon || '').trim(),
                tva: Boolean(tva.scpTVA),
                stare: (dg.stare_inregistrare || 'ACTIV').trim(),
                judet: (sediu.sdenumire_Judet || dom.ddenumire_Judet || '').trim(),
                localitate: (sediu.sdenumire_Localitate || dom.ddenumire_Localitate || '').trim()
              });
            } else {
              resolve({
                success: false,
                message: `Codul fiscal (CUI) ${cleanCui} nu a fost găsit în registrul oficial ANAF.`
              });
            }
          } catch (err) {
            reject(new Error('Eroare la procesarea răspunsului ANAF: ' + err.message));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error('Nu s-a putut contacta serverul ANAF: ' + err.message));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Conexiunea la ANAF a expirat (timeout 10s).'));
      });

      req.write(postData);
      req.end();
    });
  }

  if (pathname === '/api/anaf') {
    const cuiQuery = parsedUrl.query.cui || '';
    if (!cuiQuery) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: 'Parametrul CUI este obligatoriu.' }));
      return;
    }

    fetchAnafCompany(cuiQuery).then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    }).catch(err => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
    return;
  }

  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      port: PORT,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // ====================================================================
  // MULTI-YEAR ARCHITECTURE & IMMUTABLE ORDER SNAPSHOTS API
  // ====================================================================
  function getYearsData() {
    if (fs.existsSync(YEARS_DATA_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(YEARS_DATA_FILE, 'utf-8'));
      } catch (e) {
        console.error('Eroare citire tubulatura_years_data.json:', e.message);
      }
    }
    return { activeYear: 2026, years: {}, orders: [] };
  }
  function saveYearsData(d) {
    fs.writeFileSync(YEARS_DATA_FILE, JSON.stringify(d, null, 2), 'utf-8');
    if (pgPool) {
      pgPool.query(
        "INSERT INTO kv_store (key, data, updated_at) VALUES ('years_data', $1, NOW()) ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()",
        [d]
      ).catch(e => console.error('[DATABASE SAVE ERROR]:', e.message));
    }
  }

  if (pathname === '/api/years') {
    const yData = getYearsData();
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        activeYear: yData.activeYear || 2026,
        years: Object.values(yData.years || {})
      }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const newYear = parseInt(payload.year, 10);
          const cloneFrom = parseInt(payload.cloneFrom || yData.activeYear || 2026, 10);
          if (!newYear || isNaN(newYear)) throw new Error('An invalid');

          const sourceYear = yData.years[String(cloneFrom)] || Object.values(yData.years)[0] || {};
          yData.years[String(newYear)] = {
            year: newYear,
            isActive: true,
            settings: JSON.parse(JSON.stringify(sourceYear.settings || {
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
            })),
            spiroPrices: JSON.parse(JSON.stringify(sourceYear.spiroPrices || {})),
            ordersCount: 0
          };
          saveYearsData(yData);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, message: `Anul ${newYear} a fost inițializat cu succes prin clonare din ${cloneFrom}!`, year: newYear }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/years/activate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const yData = getYearsData();
        const targetYear = parseInt(payload.year, 10);
        if (yData.years[String(targetYear)]) {
          yData.activeYear = targetYear;
          saveYearsData(yData);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, activeYear: targetYear }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Anul ${targetYear} nu există.` }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/parameters') {
    const yData = getYearsData();
    const queryYear = parsedUrl.query.year || yData.activeYear || '2026';
    const yearConfig = yData.years[String(queryYear)] || yData.years['2026'] || {};

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        year: queryYear,
        settings: yearConfig.settings || {},
        spiroPrices: yearConfig.spiroPrices || {}
      }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const targetYear = String(payload.year || yData.activeYear || '2026');
          if (!yData.years[targetYear]) {
            yData.years[targetYear] = { year: parseInt(targetYear, 10), isActive: true, settings: {}, spiroPrices: {}, ordersCount: 0 };
          }
          if (payload.settings) {
            yData.years[targetYear].settings = Object.assign(yData.years[targetYear].settings || {}, payload.settings);
          }
          if (payload.spiroPrices) {
            yData.years[targetYear].spiroPrices = Object.assign(yData.years[targetYear].spiroPrices || {}, payload.spiroPrices);
          }
          saveYearsData(yData);

          // Sincronizare și în tubulatura_saved_data.json pentru compatibilitate directă
          const pData = getProjectData();
          if (pData.settings && payload.settings) {
            pData.settings.pretMpRectangular = payload.settings.pretMpRectangular || pData.settings.pretMpRectangular;
            pData.settings.cursEur = payload.settings.cursEur || pData.settings.cursEur;
            pData.settings.tva = payload.settings.tva !== undefined ? payload.settings.tva : pData.settings.tva;
            saveProjectData(pData);
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, message: `Parametrii pentru anul ${targetYear} au fost actualizați!` }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/orders') {
    const yData = getYearsData();
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(yData.orders || []));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const currentYear = yData.activeYear || 2026;
          const yearKey = String(currentYear);
          const orderIdx = ((yData.years[yearKey] && yData.years[yearKey].ordersCount) || (yData.orders || []).length) + 1;
          const orderNumber = `${currentYear}-${String(orderIdx).padStart(5, '0')}`;

          const newOrder = {
            id: `CMD-${orderNumber}`,
            orderNumber: orderNumber,
            year: currentYear,
            client: payload.client || 'Beneficiar Nespecificat',
            project: payload.project || 'Proiect Standard HVAC',
            date: payload.date || new Date().toISOString().slice(0, 10),
            status: 'CONFIRMED',
            totalEur: payload.totalEur || 0,
            totalRon: payload.totalRon || 0,
            totalMp: payload.totalMp || 0,
            totalPiese: payload.totalPiese || 0,
            calculation_snapshot: payload.calculation_snapshot || {
              year: currentYear,
              timestamp: new Date().toISOString(),
              settings: yData.years[yearKey]?.settings || {},
              cursEur: yData.years[yearKey]?.settings?.cursEur || 5.2542
            },
            items: payload.items || []
          };

          if (!yData.orders) yData.orders = [];
          yData.orders.unshift(newOrder);
          if (yData.years[yearKey]) yData.years[yearKey].ordersCount = orderIdx;
          saveYearsData(yData);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, order: newOrder }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/orders/update-status' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { orderId, status } = payload;
        const yData = getYearsData();
        const order = (yData.orders || []).find(o => o.id === orderId || o.orderNumber === orderId);
        if (!order) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Comanda nu a fost găsită' }));
          return;
        }
        order.status = status;
        saveYearsData(yData);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, order }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Security check: strictly ensure the file is within __dirname
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(__dirname))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Pagina nu a fost găsită</h1><p><a href="/">Înapoi la aplicație</a></p>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`[KronVent HVAC] Serverul rulează pe:`);
  console.log(`  -> http://localhost:${PORT}`);
  console.log(`  -> http://127.0.0.1:${PORT}`);
  console.log(`=======================================================`);
});
