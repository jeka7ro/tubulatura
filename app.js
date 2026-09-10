/**
 * ====================================================================
 * SISTEM CALCUL & COMENZI TUBULATURĂ HVAC - Universal Comp Prod
 * Client-side Logic (macOS Architecture, Rectangular + Circular Spiro)
 * ====================================================================
 */

// Application State
const state = {
  settings: {
    pretMpRectangular: 15.00, // 15 €/mp conform cerinței clientului
    cursEur: 5.2542,          // Curs oficial BNR (curs.bnr.ro)
    cursBnrDate: '09.09.2026',// Data oficială a cursului de schimb
    tva: 21                   // Cota standard TVA România (21%)
  },
  meta: {
    furnizor: 'KronVent Brașov',
    client: '',
    subiect: '',
    numar: '',
    data: ''
  },
  activeCategoryMode: 'RECTANGULAR', // 'RECTANGULAR' or 'CIRCULAR'
  items: [],
  filteredItems: [],
  currentPage: 1,
  rowsPerPage: 15,
  filters: {
    search: '',
    category: '',
    flange: ''
  },
  currentPieceType: 'CRD',
  editingIndex: -1
};

// ====================================================================
// DIAMETRE STANDARDIZATE PENTRU TUBULATURĂ CIRCULARĂ (DIN EN 1506)
// ====================================================================
const STANDARD_CIRCULAR_DIAMETERS = [
  100, 125, 150, 160, 180, 200, 224, 250, 280, 300, 315, 355, 400, 450, 500, 560, 600, 630, 710, 800, 900, 1000, 1120, 1250
];

// Grilă de prețuri standard circulară (Spiro €/ml, Fitinguri €/buc)
function getCircularPrices(d) {
  // Bază proporțională cu diametrul
  const factor = d / 100;
  const spiroMl = 6.0 + factor * 2.8;       // ex: d100 -> 8.8€/ml, d200 -> 11.6€/ml, d315 -> 14.8€/ml
  const cot90 = 7.5 + factor * 4.5;         // ex: d100 -> 12€/buc, d200 -> 16.5€/buc
  const cot45 = 6.0 + factor * 3.8;
  const teu90 = 11.0 + factor * 6.5;
  const reductie = 8.0 + factor * 4.0;
  const stut = 4.0 + factor * 2.0;
  const capac = 3.5 + factor * 1.8;
  const clapeta = 14.0 + factor * 7.0;

  return {
    spiroMl: parseFloat(spiroMl.toFixed(2)),
    cot90: parseFloat(cot90.toFixed(2)),
    cot45: parseFloat(cot45.toFixed(2)),
    teu90: parseFloat(teu90.toFixed(2)),
    reductie: parseFloat(reductie.toFixed(2)),
    stut: parseFloat(stut.toFixed(2)),
    capac: parseFloat(capac.toFixed(2)),
    clapeta: parseFloat(clapeta.toFixed(2))
  };
}

// ====================================================================
// NOMENCLATOR PIESE RECTANGULARE (Formule Exacte din Fișierul Excel)
// ====================================================================
const RECTANGULAR_CONFIGS = {
  CRD: {
    name: 'Canal Drept Rectangular',
    code: 'CRD',
    category: 'Canal drept',
    cadImage: 'assets/icons3d/CRD.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 7l8-4 8 4v10l-8 4-8-4V7z"></path><path d="M4 7l8 4 8-4"></path><line x1="12" y1="11" x2="12" y2="21"></line></svg>`,
    fields: [
      { id: 'dim_A', label: 'Lățime (A)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_L', label: 'Lungime (L)', unit: 'mm', default: 1250, min: 100 }
    ],
    calc: (p, pretMp) => {
      const A = p.dim_A || 500;
      const B = p.dim_B || 500;
      const L = p.dim_L || 1250;
      const cant = p.cant || 1;
      const sUnit = (2 * (A / 1000) + 2 * (B / 1000)) * (L / 1000);
      const sTot = sUnit * cant;
      const maxDim = Math.max(A, B);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = ((A + B) * 2 > 3500) ? 'FLANSA30' : 'FLANSA20';
      const mlFlansa = ((A + B) * 4 / 1000) * cant;
      const coltari = cant * 8;
      const density = grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85);
      return {
        dimText: `A=${A};B=${B};L=${L}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(mlFlansa.toFixed(2)),
        coltari,
        greutate: parseFloat((sTot * density).toFixed(2))
      };
    }
  },

  CR: {
    name: 'Cot Rectangular 90°/45°',
    code: 'CR',
    category: 'Cot rectangular ( fara dirijori )',
    cadImage: 'assets/icons3d/CR.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 20h8a8 8 0 0 0 8-8V4"></path><path d="M4 14h4a4 4 0 0 0 4-4V4"></path></svg>`,
    fields: [
      { id: 'dim_A1', label: 'Intrare (A1)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_A2', label: 'Ieșire (A2)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_R', label: 'Rază (R)', unit: 'mm', default: 150, min: 50 },
      { id: 'dim_Unghi', label: 'Unghi (<)', unit: '°', default: 90, min: 15, max: 90 }
    ],
    calc: (p, pretMp) => {
      const A1 = p.dim_A1 || 500;
      const A2 = p.dim_A2 || 500;
      const B = p.dim_B || 300;
      const R = p.dim_R || 150;
      const angle = p.dim_Unghi || 90;
      const cant = p.cant || 1;
      const maxA = Math.max(A1, A2);
      const sUnit = ((2 * (A1 + R) * (A2 + R) + Math.PI * B * (R + maxA / 2)) * (angle / 90)) / 1000000;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A1, B);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = ((A1 + B) * 2 > 3500) ? 'FLANSA30' : 'FLANSA20';
      const mlFlansa = (((A1 + B) * 2 + (A2 + B) * 2) / 1000) * cant;
      const coltari = cant * 8;
      const density = grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85);
      return {
        dimText: `A1=${A1}; A2=${A2}; B=${B}; R=${R}; <=${angle}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(mlFlansa.toFixed(2)),
        coltari,
        greutate: parseFloat((sTot * density).toFixed(2))
      };
    }
  },

  CRDr: {
    name: 'Cot Rectangular Drept',
    code: 'CRDr',
    category: 'Cot rectangular drept',
    cadImage: 'assets/icons3d/CRDr.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 20h16V4h-6v10H4v6z"></path></svg>`,
    fields: [
      { id: 'dim_A1', label: 'Intrare (A1)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_A2', label: 'Ieșire (A2)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_R', label: 'Rază (R)', unit: 'mm', default: 150, min: 50 },
      { id: 'dim_Unghi', label: 'Unghi (<)', unit: '°', default: 90, min: 15, max: 90 }
    ],
    calc: (p, pretMp) => {
      const A1 = p.dim_A1 || 500;
      const A2 = p.dim_A2 || 500;
      const B = p.dim_B || 300;
      const R = p.dim_R || 150;
      const angle = p.dim_Unghi || 90;
      const cant = p.cant || 1;
      const raw = ((A1 / 1000 + R / 1000) * (A2 / 1000 + R / 1000) * 2 + (A1 / 1000 + A2 / 1000 + 4 * R / 1000) * (B / 1000)) * (angle / 90);
      const sUnit = Math.round(raw * 100) / 100;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A1, B);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = ((A1 + B) * 2 > 3500) ? 'FLANSA30' : 'FLANSA20';
      const mlFlansa = (((A1 + B) * 2 + (A2 + B) * 2) / 1000) * cant;
      const coltari = cant * 8;
      const density = grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85);
      return {
        dimText: `A1=${A1}; A2=${A2}; B=${B}; R=${R}; <=${angle}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(mlFlansa.toFixed(2)),
        coltari,
        greutate: parseFloat((sTot * density).toFixed(2))
      };
    }
  },

  CRDir: {
    name: 'Cot cu Dirijori Aerodinamici',
    code: 'CRDir',
    category: 'Cot rectangular cu dirijori',
    cadImage: 'assets/icons3d/CRDir.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 20h8a8 8 0 0 0 8-8V4"></path><path d="M6 17a5 5 0 0 0 5-5"></path><path d="M8 19a7 7 0 0 0 7-7"></path></svg>`,
    fields: [
      { id: 'dim_A1', label: 'Intrare (A1)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_A2', label: 'Ieșire (A2)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_R', label: 'Rază (R)', unit: 'mm', default: 150, min: 50 },
      { id: 'dim_Unghi', label: 'Unghi (<)', unit: '°', default: 90, min: 15, max: 90 },
      { id: 'dim_Dirijori', label: 'Nr. Dirijori', unit: 'lamele', type: 'select', options: [1, 2, 3], default: 2 }
    ],
    calc: (p, pretMp) => {
      const A1 = p.dim_A1 || 500;
      const A2 = p.dim_A2 || 500;
      const B = p.dim_B || 400;
      const R = p.dim_R || 150;
      const angle = p.dim_Unghi || 90;
      const nDir = parseInt(p.dim_Dirijori, 10) || 2;
      const cant = p.cant || 1;
      const maxA = Math.max(A1, A2);
      let vaneArea = 0;
      if (nDir === 1) vaneArea = (Math.PI * (A1 / 3 + R) * B / 2);
      else if (nDir === 2) vaneArea = (Math.PI * ((A1 / 4 + R) + (A1 / 2 + R)) * B / 2);
      else vaneArea = (Math.PI * ((A1 / 8 + R) + (A1 / 3 + R) + (A1 / 2 + R)) * B / 2);
      const sUnit = ((2 * (A1 + R) * (A2 + R) + Math.PI * B * (R + maxA / 2) + vaneArea) * (angle / 90)) / 1000000;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A1, B);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = ((A1 + B) * 2 > 3500) ? 'FLANSA30' : 'FLANSA20';
      const mlFlansa = (((A1 + B) * 2 + (A2 + B) * 2) / 1000) * cant;
      const coltari = cant * 8;
      const density = grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85);
      return {
        dimText: `A1=${A1}; A2=${A2}; B=${B}; R=${R}; <=${angle}; Dir=${nDir}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(mlFlansa.toFixed(2)),
        coltari,
        greutate: parseFloat((sTot * density).toFixed(2))
      };
    }
  },

  TR: {
    name: 'Teu Rectangular',
    code: 'TR',
    category: 'Teu',
    cadImage: 'assets/icons3d/TR.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M3 8h6v12h6V8h6V4H3v4z"></path></svg>`,
    fields: [
      { id: 'dim_A', label: 'Tronson Principal (A)', unit: 'mm', default: 800, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_C', label: 'Ramificație (C)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_R', label: 'Rază (R)', unit: 'mm', default: 100, min: 50 }
    ],
    calc: (p, pretMp) => {
      const A = p.dim_A || 800;
      const B = p.dim_B || 400;
      const C = p.dim_C || 500;
      const R = p.dim_R || 100;
      const L = A + 2 * R;
      const cant = p.cant || 1;
      const raw = ((2 * (C + R) + B) / 1000) * (L / 1000) + ((L - A + 2 * R) / 1000) * (B / 1000);
      const sUnit = Math.round(raw * 100) / 100;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A, B, C);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = (Math.max(B, C) + Math.max(B, A)) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      const mlFlansa = (((A + B) * 2 + (C + B) * 2 + (A + B) * 2) / 1000) * cant;
      return {
        dimText: `A=${A}; B=${B}; C=${C}; R=${R}; L=${L}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(mlFlansa.toFixed(2)),
        coltari: cant * 12,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  PDE: {
    name: 'Piesă Deviație (Etaj)',
    code: 'PDE',
    category: 'Piesa de deviatie (etaj)',
    cadImage: 'assets/icons3d/PDE.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 6h8l6 12h6"></path><path d="M4 10h6l6 12h4"></path></svg>`,
    fields: [
      { id: 'dim_A', label: 'Lățime (A)', unit: 'mm', default: 600, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_F', label: 'Fugă/Deviație (F)', unit: 'mm', default: 150, min: 20 },
      { id: 'dim_L', label: 'Lungime (L)', unit: 'mm', default: 800, min: 100 }
    ],
    calc: (p, pretMp) => {
      const A = p.dim_A || 600;
      const B = p.dim_B || 300;
      const F = p.dim_F || 150;
      const L = p.dim_L || 800;
      const cant = p.cant || 1;
      const raw = 2 * ((A + F) / 1000) * (L / 1000) + Math.sqrt(Math.pow(F / 1000, 2) + Math.pow(L / 1000, 2)) * (B / 1000) * 2;
      const sUnit = Math.round(raw * 100) / 100;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A, B);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = (A + B) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      const mlFlansa = ((A + B) * 4 / 1000) * cant;
      return {
        dimText: `A=${A}; B=${B}; F=${F}; L=${L}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(mlFlansa.toFixed(2)),
        coltari: cant * 8,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  Red: {
    name: 'Reducție Simetrică / Asimetrică',
    code: 'Red',
    category: 'Reductie simetrica/asimetrica',
    cadImage: 'assets/icons3d/Red.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M3 5h18l-4 14H7L3 5z"></path></svg>`,
    fields: [
      { id: 'dim_A', label: 'Intrare Lățime (A)', unit: 'mm', default: 800, min: 50 },
      { id: 'dim_B', label: 'Intrare Înălțime (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_C', label: 'Ieșire Lățime (C)', unit: 'mm', default: 500, min: 50 },
      { id: 'dim_D', label: 'Ieșire Înălțime (D)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_e', label: 'Decalaj Orizontal (e)', unit: 'mm', default: 0, min: 0 },
      { id: 'dim_f', label: 'Decalaj Vertical (f)', unit: 'mm', default: 0, min: 0 },
      { id: 'dim_L', label: 'Lungime (L)', unit: 'mm', default: 300, min: 100 }
    ],
    calc: (p, pretMp) => {
      const A = p.dim_A || 800;
      const B = p.dim_B || 300;
      const C = p.dim_C || 500;
      const D = p.dim_D || 300;
      const e = p.dim_e || 0;
      const f = p.dim_f || 0;
      const L = p.dim_L || 300;
      const cant = p.cant || 1;
      // Exact Excel formula from sheet 'Reductie simetrica_asim.' (Row 6)
      let s = ((B + D) / 2 * Math.sqrt(L * L + e * e) + (B + D) / 2 * Math.sqrt(L * L + Math.pow(A - C - e, 2)) + (A + C) / 2 * Math.sqrt(L * L + f * f) + (A + C) * Math.sqrt(L * L + Math.pow(B - D - f, 2))) / 1000000;
      if (L <= 250) s *= 1.1;
      const sUnit = parseFloat(s.toFixed(4));
      const sTot = parseFloat((sUnit * cant).toFixed(4));
      const maxDim = Math.max(A, B, C, D);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = Math.max((A + B) * 2, (C + D) * 2) > 3500 ? 'FLANSA30' : 'FLANSA20';
      return {
        dimText: `A=${A}; B=${B}; C=${C}; D=${D}; e=${e}; f=${f}; L=${L}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat((((A + B) * 2 + (C + D) * 2) / 1000 * cant).toFixed(2)),
        coltari: cant * 8,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  YAKA: {
    name: 'Piesă Racord YAKA',
    code: 'YAKA',
    category: 'YAKA',
    cadImage: 'assets/icons3d/YAKA.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="3" y="14" width="18" height="6" rx="1"></rect><path d="M7 14V6h10v8"></path></svg>`,
    fields: [
      { id: 'dim_A', label: 'Lățime Racord (A)', unit: 'mm', default: 600, min: 50 },
      { id: 'dim_B', label: 'Înălțime Racord (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_C', label: 'Lungime Bază Canal (C)', unit: 'mm', default: 800, min: 50 },
      { id: 'dim_L', label: 'Înălțime Ștuț (L)', unit: 'mm', default: 150, min: 50 },
      { id: 'dim_G', label: 'Bordură / Talpă Fixare (G)', unit: 'mm', default: 30, min: 10 }
    ],
    calc: (p, pretMp) => {
      const A = p.dim_A || 600;
      const B = p.dim_B || 300;
      const C = p.dim_C || 800;
      const L = p.dim_L || 150;
      const G = p.dim_G || 30;
      const cant = p.cant || 1;
      const sUnit = Math.max((A + B) * 2, (C + B) * 2) * (L + G) / 1000000;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A, B, C);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = (A + B) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      return {
        dimText: `A=${A}; B=${B}; C=${C}; L=${L}; G=${G}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(((A + B) * 2 / 1000 * cant).toFixed(2)),
        coltari: cant * 4,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  R2C: {
    name: 'Ramificație Bilaterală (2 Coturi)',
    code: 'R2C',
    category: 'Ramif. bilaterala (2 coturi)',
    cadImage: 'assets/icons3d/R2C.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 21V13M12 13L6 4M12 13l6-9"></path><path d="M3 4h6M15 4h6"></path></svg>`,
    fields: [
      { id: 'dim_C1', label: 'Intrare 1 (C1)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_C2', label: 'Ieșire 1 (C2)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_R', label: 'Rază (R)', unit: 'mm', default: 150, min: 50 },
      { id: 'dim_D1', label: 'Intrare 2 (D1)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_D2', label: 'Ieșire 2 (D2)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_Unghi', label: 'Unghi (<)', unit: '°', default: 90, min: 15, max: 90 }
    ],
    calc: (p, pretMp) => {
      const C1 = p.dim_C1 || 300;
      const C2 = p.dim_C2 || 300;
      const B = p.dim_B || 300;
      const R = p.dim_R || 150;
      const D1 = p.dim_D1 || 300;
      const D2 = p.dim_D2 || 300;
      const angle = p.dim_Unghi || 90;
      const cant = p.cant || 1;
      const sUnit = (((C1 + R) * (C2 + R) * 2 + 3.14 * B * (2 * R + C1) / 2) * angle / 90 + ((D1 + R) * (D2 + R) * 2 + 3.14 * B * (2 * R + D1) / 2) * angle / 90) / 1000000;
      const sTot = sUnit * cant;
      const maxDim = Math.max(C1, C2, B, D1, D2);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = (C1 + B) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      return {
        dimText: `C1=${C1}; C2=${C2}; B=${B}; R=${R}; D1=${D1}; D2=${D2}; <=${angle}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat((((C1 + B) * 2 + (C2 + B) * 2 + (D2 + B) * 2) / 1000 * cant).toFixed(2)),
        coltari: cant * 12,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  RCC: {
    name: 'Ramificație Laterală (Cot+Canal)',
    code: 'RCC',
    category: 'Ramif. laterala(cot+canal)',
    cadImage: 'assets/icons3d/RCC.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 18h16V6H4v12z"></path><path d="M12 6V2h6v4"></path></svg>`,
    fields: [
      { id: 'dim_D1', label: 'Intrare Cot (D1)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_D2', label: 'Ieșire Cot (D2)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_R', label: 'Rază (R)', unit: 'mm', default: 150, min: 50 },
      { id: 'dim_C1', label: 'Canal L1 (C1)', unit: 'mm', default: 600, min: 50 },
      { id: 'dim_C2', label: 'Canal L2 (C2)', unit: 'mm', default: 600, min: 50 },
      { id: 'dim_L', label: 'Lungime Tronson (L)', unit: 'mm', default: 1250, min: 100 },
      { id: 'dim_Unghi', label: 'Unghi Cot (<)', unit: '°', default: 90, min: 15, max: 90 }
    ],
    calc: (p, pretMp) => {
      const D1 = p.dim_D1 || 400;
      const D2 = p.dim_D2 || 400;
      const B = p.dim_B || 300;
      const R = p.dim_R || 150;
      const C1 = p.dim_C1 || 600;
      const C2 = p.dim_C2 || 600;
      const L = p.dim_L || 1250;
      const angle = p.dim_Unghi || 90;
      const cant = p.cant || 1;
      const sUnit = (((D1 + R) * (D2 + R) * 2 + Math.PI * B * (2 * R + D1) / 2) * angle / 90 + Math.max((C1 + B) * 2, (C2 + B) * 2) * L) / 1000000;
      const sTot = sUnit * cant;
      const maxDim = Math.max(D1, D2, B, C1, C2);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = (D1 + B) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      return {
        dimText: `D1=${D1}; D2=${D2}; B=${B}; R=${R}; C1=${C1}; C2=${C2}; <=${angle}; L=${L}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat((((D1 + B) * 2 + (C1 + B) * 2 + (C2 + B) * 2) / 1000 * cant).toFixed(2)),
        coltari: cant * 12,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  RP: {
    name: 'Ramificație Pantalon',
    code: 'RP',
    category: 'Ramif. pantalon',
    cadImage: 'assets/icons3d/RP.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M6 3h12v7l-3 11H9L6 10V3z"></path><path d="M12 10v11"></path></svg>`,
    fields: [
      { id: 'dim_A', label: 'Trunchi (A)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_C', label: 'Crac 1 (C)', unit: 'mm', default: 250, min: 50 },
      { id: 'dim_D', label: 'Crac 2 (D)', unit: 'mm', default: 250, min: 50 },
      { id: 'dim_E', label: 'Distanță Craci (E)', unit: 'mm', default: 200, min: 20 },
      { id: 'dim_H', label: 'Înălțime Pantalon (H)', unit: 'mm', default: 150, min: 50 },
      { id: 'dim_L', label: 'Lungime Totală (L)', unit: 'mm', default: 600, min: 100 }
    ],
    calc: (p, pretMp) => {
      const A = p.dim_A || 400;
      const B = p.dim_B || 300;
      const C = p.dim_C || 250;
      const D = p.dim_D || 250;
      const E = p.dim_E || 200;
      const H = p.dim_H || 150;
      const L = p.dim_L || 600;
      const cant = p.cant || 1;
      const sUnit = (Math.max((A + B) * 2, (C + D + E + B) * 2) * L + 2 * Math.sqrt(H * H + (E * E) / 4) * B) / 1000000;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A, B, C, D);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = (A + B) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      return {
        dimText: `A=${A}; B=${B}; C=${C}; D=${D}; E=${E}; H=${H}; L=${L}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat((((A + B) * 2 + (C + B) * 2 + (D + B) * 2) / 1000 * cant).toFixed(2)),
        coltari: cant * 12,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  Capac: {
    name: 'Capac Rectangular',
    code: 'Capac',
    category: 'Capac',
    cadImage: 'assets/icons3d/Capac.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"></rect><line x1="3" y1="6" x2="21" y2="18"></line><line x1="21" y1="6" x2="3" y2="18"></line></svg>`,
    fields: [
      { id: 'dim_A', label: 'Lățime (A)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_B', label: 'Înălțime (B)', unit: 'mm', default: 300, min: 50 }
    ],
    calc: (p, pretMp) => {
      const A = p.dim_A || 400;
      const B = p.dim_B || 300;
      const cant = p.cant || 1;
      const raw = ((A + 60) * (B + 60)) / 1000000;
      const sUnit = Math.round(raw * 10000) / 10000;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A, B);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = (A + B) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      return {
        dimText: `A=${A}; B=${B}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(((A + B) * 2 / 1000 * cant).toFixed(2)),
        coltari: cant * 4,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  SSC: {
    name: 'Schimbare Secțiune Concentrică',
    code: 'SSC',
    category: 'Schimbare sec.concentrica',
    cadImage: 'assets/icons3d/SSC.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"></circle><rect x="4" y="14" width="16" height="7" rx="1"></rect><line x1="8" y1="7" x2="4" y2="14"></line><line x1="16" y1="7" x2="20" y2="14"></line></svg>`,
    fields: [
      { id: 'dim_d', label: 'Diametru Rotund (Ød)', unit: 'mm', default: 250, min: 50 },
      { id: 'dim_A', label: 'Lățime Rectangular (A)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_B', label: 'Înălțime Rectangular (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_L', label: 'Lungime Piesă (L)', unit: 'mm', default: 600, min: 100 }
    ],
    calc: (p, pretMp) => {
      const d = p.dim_d || 250;
      const A = p.dim_A || 400;
      const B = p.dim_B || 300;
      const L = p.dim_L || 600;
      const cant = p.cant || 1;
      const sUnit = 3.14 * Math.sqrt(Math.pow((A + B) / 3.14 - d / 2, 2) + L * L) * (1 + 0.06 * A / B + 0.09 * A / d + 0.25 * 500 / (4 * L)) * ((A + B) / 3.14 + d / 2) / 1000000;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A, B, d);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = (A + B) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      return {
        dimText: `Ød=${d}; A=${A}; B=${B}; L=${L}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(((A + B) * 2 / 1000 * cant).toFixed(2)),
        coltari: cant * 4,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  SSE: {
    name: 'Schimbare Secțiune Excentrică',
    code: 'SSE',
    category: 'Schimbare sec.excentrica',
    cadImage: 'assets/icons3d/SSE.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="16" cy="7" r="4"></circle><rect x="4" y="14" width="16" height="7" rx="1"></rect><line x1="12" y1="7" x2="4" y2="14"></line><line x1="20" y1="7" x2="20" y2="14"></line></svg>`,
    fields: [
      { id: 'dim_d', label: 'Diametru Rotund (Ød)', unit: 'mm', default: 250, min: 50 },
      { id: 'dim_A', label: 'Lățime Rectangular (A)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_B', label: 'Înălțime Rectangular (B)', unit: 'mm', default: 300, min: 50 },
      { id: 'dim_L', label: 'Lungime Piesă (L)', unit: 'mm', default: 600, min: 100 }
    ],
    calc: (p, pretMp) => {
      const d = p.dim_d || 250;
      const A = p.dim_A || 400;
      const B = p.dim_B || 300;
      const L = p.dim_L || 600;
      const cant = p.cant || 1;
      const sUnit = 3.14 * Math.sqrt(Math.pow((A + B) / 3.14 - d / 2, 2) + L * L) * (1 + 0.06 * A / B + 0.09 * A / d + 0.25 * 500 / (4 * L)) * ((A + B) / 3.14 + d / 2) / 1000000;
      const sTot = sUnit * cant;
      const maxDim = Math.max(A, B, d);
      const grosime = maxDim <= 500 ? '0.6' : (maxDim <= 1000 ? '0.8' : '1.0');
      const flansa = (A + B) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      return {
        dimText: `Ød=${d}; A=${A}; B=${B}; L=${L}`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(((A + B) * 2 / 1000 * cant).toFixed(2)),
        coltari: cant * 4,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : (grosime === '0.8' ? 6.28 : 7.85))).toFixed(2))
      };
    }
  },

  Plenum: {
    name: 'Plenum Cutie Difuzor',
    code: 'Plenum',
    category: 'Plenum',
    cadImage: 'assets/icons3d/Plenum.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    fields: [
      { id: 'dim_A', label: 'Lățime Cască (A)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_B', label: 'Lungime Cască (B)', unit: 'mm', default: 400, min: 50 },
      { id: 'dim_H', label: 'Înălțime Cutie (H)', unit: 'mm', default: 350, min: 50 },
      { id: 'dim_d', label: 'Diametru Ștuț (Ød)', unit: 'mm', default: 200, min: 50 },
      { id: 'dim_NrStuturi', label: 'Nr. Ștuțuri Racord', unit: 'buc', type: 'select', options: [1, 2, 3, 4], default: 1 }
    ],
    calc: (p, pretMp) => {
      const A = p.dim_A || 400;
      const B = p.dim_B || 400;
      const H = p.dim_H || 350;
      const d = p.dim_d || 200;
      const nStut = parseInt(p.dim_NrStuturi, 10) || 1;
      const cant = p.cant || 1;
      const sUnit = (((A / 1000) * 2 + (B / 1000) * 2) * (H / 1000) + (A / 1000) * (B / 1000) + nStut * ((d / 1000) * 3.14 * 0.1));
      const sTot = sUnit * cant;
      const maxDim = Math.max(A, B, H);
      const grosime = maxDim <= 500 ? '0.6' : '0.8';
      const flansa = (A + B) * 2 > 3500 ? 'FLANSA30' : 'FLANSA20';
      return {
        dimText: `A=${A}; B=${B}; H=${H}; Stut=Ø${d} (${nStut}buc)`,
        sUnit: parseFloat(sUnit.toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat((sUnit * pretMp).toFixed(2)),
        valoareTotala: parseFloat((sTot * pretMp).toFixed(2)),
        grosime,
        flansa,
        mlFlansa: parseFloat(((A + B) * 2 / 1000 * cant).toFixed(2)),
        coltari: cant * 4,
        greutate: parseFloat((sTot * (grosime === '0.6' ? 4.71 : 6.28)).toFixed(2))
      };
    }
  }
};

// ====================================================================
// NOMENCLATOR PIESE CIRCULARE (SPIRO & ACCESORII EN 1506)
// ====================================================================
const CIRCULAR_CONFIGS = {
  Spiro: {
    name: 'Tubulatură Circulară Spiro',
    code: 'SPIRO',
    category: 'Tubulatura Circulara Spiro',
    cadImage: 'assets/icons3d/Spiro.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"></path><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"></path></svg>`,
    fields: [
      { id: 'dim_D', label: 'Diametru (Ød)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 200 },
      { id: 'dim_L_ml', label: 'Lungime Totală', unit: 'ml', default: 6, min: 1, step: 0.5 }
    ],
    calc: (p) => {
      const D = p.dim_D || 200;
      const L_ml = p.dim_L_ml || 6;
      const prices = getCircularPrices(D);
      const pretUnitar = prices.spiroMl;
      const valoareTotala = pretUnitar * L_ml;
      const sTot = (Math.PI * (D / 1000) * L_ml);
      const greutate = sTot * 4.71;
      return {
        dimText: `Ø=${D} mm; L=${L_ml} ml`,
        sUnit: parseFloat((sTot / L_ml).toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat(pretUnitar.toFixed(2)),
        valoareTotala: parseFloat(valoareTotala.toFixed(2)),
        grosime: D <= 500 ? '0.6' : '0.8',
        flansa: 'Niplu / Mufă',
        mlFlansa: 0,
        coltari: 0,
        greutate: parseFloat(greutate.toFixed(2)),
        um: 'ml',
        cantitate: L_ml
      };
    }
  },

  CotCirc90: {
    name: 'Cot Circular 90°',
    code: 'CC90',
    category: 'Tubulatura Circulara Spiro',
    cadImage: 'assets/icons3d/CotCirc90.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 20h7a9 9 0 0 0 9-9V4"></path><path d="M4 15h4a5 5 0 0 0 5-5V4"></path></svg>`,
    fields: [
      { id: 'dim_D', label: 'Diametru (Ød)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 200 }
    ],
    calc: (p) => {
      const D = p.dim_D || 200;
      const cant = p.cant || 1;
      const prices = getCircularPrices(D);
      const pretUnitar = prices.cot90;
      const valoareTotala = pretUnitar * cant;
      const sTot = (Math.PI * (D / 1000) * (D / 1000 * 1.5)) * cant;
      return {
        dimText: `Ø=${D} mm; <=90°`,
        sUnit: parseFloat((sTot / cant).toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat(pretUnitar.toFixed(2)),
        valoareTotala: parseFloat(valoareTotala.toFixed(2)),
        grosime: '0.6',
        flansa: 'Garnitură EPDM',
        mlFlansa: 0,
        coltari: 0,
        greutate: parseFloat((sTot * 4.71).toFixed(2)),
        um: 'buc',
        cantitate: cant
      };
    }
  },

  CotCirc45: {
    name: 'Cot Circular 45°',
    code: 'CC45',
    category: 'Tubulatura Circulara Spiro',
    cadImage: 'assets/icons3d/CotCirc45.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 20h6l10-10"></path><line x1="14" y1="4" x2="20" y2="4"></line><line x1="20" y1="4" x2="20" y2="10"></line></svg>`,
    fields: [
      { id: 'dim_D', label: 'Diametru (Ød)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 200 }
    ],
    calc: (p) => {
      const D = p.dim_D || 200;
      const cant = p.cant || 1;
      const prices = getCircularPrices(D);
      const pretUnitar = prices.cot45;
      const valoareTotala = pretUnitar * cant;
      const sTot = (Math.PI * (D / 1000) * (D / 1000 * 0.8)) * cant;
      return {
        dimText: `Ø=${D} mm; <=45°`,
        sUnit: parseFloat((sTot / cant).toFixed(4)),
        sTot: parseFloat(sTot.toFixed(4)),
        pretUnitar: parseFloat(pretUnitar.toFixed(2)),
        valoareTotala: parseFloat(valoareTotala.toFixed(2)),
        grosime: '0.6',
        flansa: 'Garnitură EPDM',
        mlFlansa: 0,
        coltari: 0,
        greutate: parseFloat((sTot * 4.71).toFixed(2)),
        um: 'buc',
        cantitate: cant
      };
    }
  },

  TeuCirc: {
    name: 'Teu Circular Simetric 90°',
    code: 'TC90',
    category: 'Tubulatura Circulara Spiro',
    cadImage: 'assets/icons3d/TeuCirc.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="12" y1="12" x2="12" y2="21"></line><circle cx="12" cy="5" r="3"></circle></svg>`,
    fields: [
      { id: 'dim_D', label: 'Diametru Principal (Ød1)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 200 },
      { id: 'dim_D2', label: 'Diametru Ramificație (Ød2)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 160 }
    ],
    calc: (p) => {
      const D = p.dim_D || 200;
      const D2 = p.dim_D2 || 160;
      const cant = p.cant || 1;
      const prices = getCircularPrices(Math.max(D, D2));
      const pretUnitar = prices.teu90;
      return {
        dimText: `Ø1=${D} mm; Ø2=${D2} mm; 90°`,
        sUnit: 0.25,
        sTot: 0.25 * cant,
        pretUnitar: parseFloat(pretUnitar.toFixed(2)),
        valoareTotala: parseFloat((pretUnitar * cant).toFixed(2)),
        grosime: '0.6',
        flansa: 'Garnitură EPDM',
        mlFlansa: 0,
        coltari: 0,
        greutate: parseFloat((cant * 2.1).toFixed(2)),
        um: 'buc',
        cantitate: cant
      };
    }
  },

  RedCirc: {
    name: 'Reducție Circulară Conică',
    code: 'RC',
    category: 'Tubulatura Circulara Spiro',
    cadImage: 'assets/icons3d/RedCirc.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="2.5"></ellipse><ellipse cx="12" cy="19" rx="4.5" ry="1.5"></ellipse><line x1="4" y1="5" x2="7.5" y2="19"></line><line x1="20" y1="5" x2="16.5" y2="19"></line></svg>`,
    fields: [
      { id: 'dim_D', label: 'Diametru Mare (Ød1)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 250 },
      { id: 'dim_D2', label: 'Diametru Mic (Ød2)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 200 }
    ],
    calc: (p) => {
      const D = p.dim_D || 250;
      const D2 = p.dim_D2 || 200;
      const cant = p.cant || 1;
      const prices = getCircularPrices(D);
      const pretUnitar = prices.reductie;
      return {
        dimText: `Ø1=${D} mm; Ø2=${D2} mm`,
        sUnit: 0.15,
        sTot: 0.15 * cant,
        pretUnitar: parseFloat(pretUnitar.toFixed(2)),
        valoareTotala: parseFloat((pretUnitar * cant).toFixed(2)),
        grosime: '0.6',
        flansa: 'Garnitură EPDM',
        mlFlansa: 0,
        coltari: 0,
        greutate: parseFloat((cant * 1.4).toFixed(2)),
        um: 'buc',
        cantitate: cant
      };
    }
  },

  StutCirc: {
    name: 'Ștuț Circular / Branșament',
    code: 'STC',
    category: 'Tubulatura Circulara Spiro',
    cadImage: 'assets/icons3d/StutCirc.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle></svg>`,
    fields: [
      { id: 'dim_D', label: 'Diametru (Ød)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 200 }
    ],
    calc: (p) => {
      const D = p.dim_D || 200;
      const cant = p.cant || 1;
      const prices = getCircularPrices(D);
      const pretUnitar = prices.stut;
      return {
        dimText: `Ø=${D} mm`,
        sUnit: 0.08,
        sTot: 0.08 * cant,
        pretUnitar: parseFloat(pretUnitar.toFixed(2)),
        valoareTotala: parseFloat((pretUnitar * cant).toFixed(2)),
        grosime: '0.6',
        flansa: 'Bordură ștanțată',
        mlFlansa: 0,
        coltari: 0,
        greutate: parseFloat((cant * 0.9).toFixed(2)),
        um: 'buc',
        cantitate: cant
      };
    }
  },

  CapacCirc: {
    name: 'Capac Circular cu Garnitură',
    code: 'CAPC',
    category: 'Tubulatura Circulara Spiro',
    cadImage: 'assets/icons3d/CapacCirc.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="3" x2="12" y2="21"></line></svg>`,
    fields: [
      { id: 'dim_D', label: 'Diametru (Ød)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 200 }
    ],
    calc: (p) => {
      const D = p.dim_D || 200;
      const cant = p.cant || 1;
      const prices = getCircularPrices(D);
      const pretUnitar = prices.capac;
      return {
        dimText: `Ø=${D} mm`,
        sUnit: 0.05,
        sTot: 0.05 * cant,
        pretUnitar: parseFloat(pretUnitar.toFixed(2)),
        valoareTotala: parseFloat((pretUnitar * cant).toFixed(2)),
        grosime: '0.6',
        flansa: 'Capac EPDM',
        mlFlansa: 0,
        coltari: 0,
        greutate: parseFloat((cant * 0.8).toFixed(2)),
        um: 'buc',
        cantitate: cant
      };
    }
  },

  NipluCirc: {
    name: 'Niplu Conectare SPIRO',
    code: 'NIPC',
    category: 'Tubulatura Circulara Spiro',
    cadImage: 'assets/icons3d/NipluCirc.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="8" rx="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line></svg>`,
    fields: [
      { id: 'dim_D', label: 'Diametru (Ød)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 200 }
    ],
    calc: (p) => {
      const D = p.dim_D || 200;
      const cant = p.cant || 1;
      const factor = D / 100;
      const pretUnitar = parseFloat((3.0 + factor * 1.5).toFixed(2));
      return {
        dimText: `Ø=${D} mm`,
        sUnit: 0.06,
        sTot: 0.06 * cant,
        pretUnitar,
        valoareTotala: parseFloat((pretUnitar * cant).toFixed(2)),
        grosime: '0.6',
        flansa: 'Cu garnitură',
        mlFlansa: 0,
        coltari: 0,
        greutate: parseFloat((cant * 0.7).toFixed(2)),
        um: 'buc',
        cantitate: cant
      };
    }
  },

  ClapetaCirc: {
    name: 'Clapetă Reglaj Circulară',
    code: 'CRC',
    category: 'Tubulatura Circulara Spiro',
    cadImage: 'assets/icons3d/ClapetaCirc.png',
    icon: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><line x1="5" y1="12" x2="19" y2="12"></line><line x1="12" y1="3" x2="12" y2="7"></line></svg>`,
    fields: [
      { id: 'dim_D', label: 'Diametru (Ød)', unit: 'mm', type: 'select', options: STANDARD_CIRCULAR_DIAMETERS, default: 200 }
    ],
    calc: (p) => {
      const D = p.dim_D || 200;
      const cant = p.cant || 1;
      const prices = getCircularPrices(D);
      const pretUnitar = prices.clapeta;
      return {
        dimText: `Ø=${D} mm`,
        sUnit: 0.10,
        sTot: 0.10 * cant,
        pretUnitar: parseFloat(pretUnitar.toFixed(2)),
        valoareTotala: parseFloat((pretUnitar * cant).toFixed(2)),
        grosime: '0.6',
        flansa: 'Fluture manual',
        mlFlansa: 0,
        coltari: 0,
        greutate: parseFloat((cant * 1.6).toFixed(2)),
        um: 'buc',
        cantitate: cant
      };
    }
  }
};

// ====================================================================
// Fetch Live BNR Official Exchange Rate
async function fetchAndApplyBnrRate() {
  try {
    const res = await fetch('/api/bnr');
    if (res.ok) {
      const data = await res.json();
      if (data && data.rate) {
        state.settings.cursEur = data.rate;
        state.settings.cursBnrDate = data.date || '09.09.2026';

        const dateEl = document.getElementById('header-bnr-date');
        const numEl = document.getElementById('header-bnr-num');
        if (dateEl) dateEl.textContent = state.settings.cursBnrDate;
        if (numEl) numEl.textContent = `${data.rate.toFixed(4)} RON`;

        console.log(`[BNR LIVE] 1 EUR = ${data.rate} RON (${state.settings.cursBnrDate})`);
        if (typeof updateKPICards === 'function') updateKPICards();
        if (typeof updateLiveCalculation === 'function') updateLiveCalculation();
        if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
      }
    }
  } catch (err) {
    console.warn('Nu s-a putut prelua cursul BNR:', err);
  }
}

// ====================================================================
// INITIALIZATION
// ====================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try { await fetchAndApplyBnrRate(); } catch (e) { console.error('fetchAndApplyBnrRate err:', e); }
  try { setupThemeToggle(); } catch (e) { console.error('setupThemeToggle err:', e); }
  try { setupLogout(); } catch (e) { console.error('setupLogout err:', e); }
  try { setupTabs(); } catch (e) { console.error('setupTabs err:', e); }
  try { setupCategorySwitcher(); } catch (e) { console.error('setupCategorySwitcher err:', e); }
  try { setupFilterListeners(); } catch (e) { console.error('setupFilterListeners err:', e); }
  try { setupActionButtons(); } catch (e) { console.error('setupActionButtons err:', e); }
  try { setupModal(); } catch (e) { console.error('setupModal err:', e); }
  
  try {
    await loadInitialData();
  } catch (e) {
    console.error('loadInitialData err:', e);
  }

  try { renderPieceSelectorGrid(); } catch (e) { console.error('renderPieceSelectorGrid err:', e); }
  try { renderPieceForm(); } catch (e) { console.error('renderPieceForm err:', e); }
  try { updateStep1SummaryBanner(); } catch (e) { console.error('updateStep1SummaryBanner err:', e); }
  try { setupRealtimeSync(); } catch (e) { console.error('setupRealtimeSync err:', e); }
});

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
        showToast('Ați fost delogat cu succes din contul de administrator.', 'info');
        
        const profile = document.querySelector('.header-admin-profile');
        if (profile) {
          profile.innerHTML = `
            <div class="admin-avatar" style="background: #64748b;">V</div>
            <div class="admin-user-details">
              <span class="admin-user-name">Vizitator / Client</span>
              <span class="admin-user-role">Sesiune Publică</span>
            </div>
          `;
          profile.setAttribute('title', 'Sesiune Publică Ofertare');
        }
        btnLogout.style.display = 'none';
      },
      null,
      'Delogare',
      'Anulează',
      true
    );
  });
}

// Setup View Switching (Configurator View <-> Coș de Cumpărături)
window.goToStep = function(stepNum) {
  const pane1 = document.getElementById('tab-configurator');
  const pane2 = document.getElementById('tab-comanda');
  const headerCartBtn = document.getElementById('btn-header-cart');
  const pageIndicator = document.getElementById('page-view-indicator');

  if (stepNum === 1) {
    if (pane1) pane1.classList.add('active');
    if (pane2) pane2.classList.remove('active');
    if (headerCartBtn) headerCartBtn.classList.remove('active');
    if (pageIndicator) pageIndicator.textContent = 'Configurator Tehnic Piese Tubulatură HVAC';

    updateStep1SummaryBanner();
  } else if (stepNum === 2) {
    if (pane1) pane1.classList.remove('active');
    if (pane2) pane2.classList.add('active');
    if (headerCartBtn) headerCartBtn.classList.add('active');
    if (pageIndicator) pageIndicator.textContent = 'Coș de Cumpărături & Centralizator Ofertare';

    // Refresh table and totals
    applyFiltersAndRender();
    updateTableTotalsRow();
    updateKPICards();
    updateAtelierTab();
  }

  // Support for any remaining tab links
  document.querySelectorAll('.mac-tab-link').forEach(btn => {
    const target = btn.getAttribute('data-target');
    if ((stepNum === 1 && target === 'tab-configurator') || (stepNum === 2 && target === 'tab-comanda')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const workspace = document.querySelector('.main-workspace');
  if (workspace) {
    workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

function updateStep1SummaryBanner() {
  const countEl = document.getElementById('step1-summary-count');
  const posEl = document.getElementById('step1-summary-positions');
  const areaEl = document.getElementById('step1-summary-area');
  const priceEl = document.getElementById('step1-summary-price');
  const nextBtnText = document.getElementById('step1-next-btn-text');

  const totalPieces = state.items.reduce((acc, it) => acc + (parseFloat(it.cantitate) || 0), 0);
  const totalArea = state.items.reduce((acc, it) => acc + (parseFloat(it.suprafata) || 0), 0);
  const totalVal = state.items.reduce((acc, it) => acc + (parseFloat(it.valoareTotala) || 0), 0);

  if (countEl) countEl.textContent = `${Math.round(totalPieces)} bucăți`;
  if (posEl) posEl.textContent = `${state.items.length} poziții`;
  if (areaEl) areaEl.textContent = `${totalArea.toFixed(2)} m²`;
  if (priceEl) priceEl.textContent = `${totalVal.toFixed(2)} €`;
  if (nextBtnText) {
    nextBtnText.textContent = `Vezi Coșul de Comandă (${state.items.length} piese) →`;
  }
}

function setupTabs() {
  const headerCartBtn = document.getElementById('btn-header-cart');
  if (headerCartBtn) {
    headerCartBtn.addEventListener('click', () => {
      const pane2 = document.getElementById('tab-comanda');
      if (pane2 && pane2.classList.contains('active')) {
        goToStep(1);
      } else {
        goToStep(2);
      }
    });
  }

  const btnGotoStep2 = document.getElementById('btn-goto-step-2');
  if (btnGotoStep2) btnGotoStep2.addEventListener('click', () => goToStep(2));

  const btnBackStep1 = document.getElementById('btn-back-to-step1');
  if (btnBackStep1) btnBackStep1.addEventListener('click', () => goToStep(1));

  const btnBackStep1Bottom = document.getElementById('btn-back-to-step1-bottom');
  if (btnBackStep1Bottom) btnBackStep1Bottom.addEventListener('click', () => goToStep(1));

  const tabs = document.querySelectorAll('.mac-tab-link');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const step = tab.getAttribute('data-step');
      if (step) {
        goToStep(parseInt(step, 10));
      } else {
        const targetId = tab.getAttribute('data-target');
        if (targetId === 'tab-configurator') goToStep(1);
        else if (targetId === 'tab-comanda') goToStep(2);
      }
    });
  });
}

// Setup Rectangular vs Circular Switcher
function setupCategorySwitcher() {
  const btnRect = document.getElementById('seg-btn-rect');
  const btnCirc = document.getElementById('seg-btn-circ');
  if (!btnRect || !btnCirc) return;

  btnRect.addEventListener('click', () => {
    btnRect.classList.add('active');
    btnCirc.classList.remove('active');
    state.activeCategoryMode = 'RECTANGULAR';
    state.currentPieceType = 'CRD';
    const t = document.getElementById('config-picker-title');
    if (t) t.textContent = 'Selectare Piesă Rectangulară';
    renderPieceSelectorGrid();
    renderPieceForm();
  });

  btnCirc.addEventListener('click', () => {
    btnCirc.classList.add('active');
    btnRect.classList.remove('active');
    state.activeCategoryMode = 'CIRCULAR';
    state.currentPieceType = 'Spiro';
    const t = document.getElementById('config-picker-title');
    if (t) t.textContent = 'Selectare Piesă Circulară Spiro (Ø100 - Ø1250)';
    renderPieceSelectorGrid();
    renderPieceForm();
  });
}

// Render Piece Selector Grid (Cards with rounded design & photorealistic 3D CAD icons)
function renderPieceSelectorGrid() {
  const grid = document.getElementById('piece-selector-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const configs = state.activeCategoryMode === 'RECTANGULAR' ? RECTANGULAR_CONFIGS : CIRCULAR_CONFIGS;

  Object.keys(configs).forEach(key => {
    const item = configs[key];
    const icon3dPath = item.icon3d || item.cadImage || `assets/icons3d/${key}.png`;
    const card = document.createElement('div');
    card.className = `piece-card-item ${key === state.currentPieceType ? 'selected' : ''}`;
    card.dataset.pieceKey = key;
    card.innerHTML = `
      <div class="piece-card-icon-wrap">
        <img src="${icon3dPath}" alt="${item.name}" class="piece-card-3d-img" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
        <div class="piece-card-icon-fallback" style="display:none;">${item.icon || ''}</div>
      </div>
      <span class="piece-card-title">${item.name}</span>
      <span class="piece-card-badge">${item.code}</span>
    `;
    card.onclick = () => {
      document.querySelectorAll('.piece-card-item').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.currentPieceType = key;
      renderPieceForm();
    };
    grid.appendChild(card);
  });
}

// Setup Filters & Search
function setupFilterListeners() {
  const tableSearch = document.getElementById('table-search');
  if (tableSearch) {
    tableSearch.addEventListener('input', (e) => {
      state.filters.search = e.target.value.toLowerCase();
      state.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const filterCat = document.getElementById('filter-categorie');
  if (filterCat) {
    filterCat.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      state.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const filterFlansa = document.getElementById('filter-flansa');
  if (filterFlansa) {
    filterFlansa.addEventListener('change', (e) => {
      state.filters.flange = e.target.value;
      state.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  // Rows per page selector
  const rowsSelect = document.getElementById('rows-per-page-select');
  if (rowsSelect) {
    rowsSelect.addEventListener('change', (e) => {
      state.rowsPerPage = e.target.value === 'all' ? Infinity : parseInt(e.target.value, 10);
      state.currentPage = 1;
      applyFiltersAndRender();
    });
  }
}

// Setup Action Buttons
function setupActionButtons() {
  const btnSave = document.getElementById('btn-save');
  if (btnSave) btnSave.addEventListener('click', saveProjectToServer);

  const btnExport = document.getElementById('btn-export-excel');
  if (btnExport) btnExport.addEventListener('click', exportToExcel);

  const btnCartExport = document.getElementById('btn-cart-export-excel');
  if (btnCartExport) btnCartExport.addEventListener('click', exportToExcel);

  // Client Excel Import Handlers
  const fileInput = document.getElementById('client-excel-input');
  const btnImportCart = document.getElementById('btn-cart-import-excel');
  const btnImportTop = document.getElementById('btn-cart-import-excel-top');

  if (btnImportCart && fileInput) {
    btnImportCart.addEventListener('click', () => fileInput.click());
  }
  if (btnImportTop && fileInput) {
    btnImportTop.addEventListener('click', () => fileInput.click());
  }
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleClientExcelImport(e.target.files[0]);
        e.target.value = ''; // Reset input so same file can be re-uploaded if needed
      }
    });
  }

  // Generate clean publication-grade official Technical Specification & Commercial Offer
  window.prepareOfficialPrintDocument = function() {
    const container = document.getElementById('print-official-document');
    if (!container) return;

    const clientName = document.getElementById('order-client')?.value.trim() || 'Client Nespecificat';
    const projectName = document.getElementById('order-proiect')?.value.trim() || 'Proiect Tubulatură HVAC';
    const orderNumber = document.getElementById('order-numar')?.value.trim() || `KV-CMD-${new Date().getFullYear()}/${(state.items.length + 10).toString()}`;
    const orderDate = document.getElementById('order-data')?.value.trim() || new Date().toLocaleDateString('ro-RO');
    const contactTel = document.getElementById('order-contact-tel')?.value.trim() || '-';
    const contactEmail = document.getElementById('order-contact-email')?.value.trim() || '-';
    const deliveryAddress = document.getElementById('order-adresa')?.value.trim() || 'Sediu Fabrică KronVent Brașov';
    const tvaRate = parseFloat(document.getElementById('order-tva-select')?.value) || 21;
    const cursBnr = state.settings.cursEur || 5.2542;

    const totalPieces = state.items.reduce((acc, it) => acc + (parseFloat(it.cantitate) || 0), 0);
    const totalArea = state.items.reduce((acc, it) => acc + (parseFloat(it.suprafata) || 0), 0);
    const totalPriceEur = state.items.reduce((acc, it) => acc + (parseFloat(it.valoareTotala) || 0), 0);
    const tvaValEur = totalPriceEur * (tvaRate / 100);
    const grandTotalEur = totalPriceEur + tvaValEur;
    const totalPriceRon = totalPriceEur * cursBnr;
    const tvaValRon = tvaValEur * cursBnr;
    const grandTotalRon = grandTotalEur * cursBnr;

    const tableRowsHtml = state.items.length > 0 ? state.items.map((it, idx) => {
      return `
        <tr>
          <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
          <td style="font-weight: 700; color: #1e3a8a; text-align: center;">${it.cod || '-'}</td>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${it.categorie || 'Piesă HVAC'}</div>
            <div style="font-size: 7.5pt; color: #64748b;">${it.eticheta || ''}</div>
          </td>
          <td style="font-size: 7.5pt; color: #1e293b;">${it.dimensiuni || '-'}</td>
          <td style="text-align: center; font-size: 8pt;">${it.grosime ? it.grosime + ' mm' : '0.6 mm'}</td>
          <td style="text-align: center; font-size: 7.5pt; font-weight: 600;">${it.flansa || '-'}</td>
          <td style="text-align: right; font-weight: 700;">${it.cantitate || 1}</td>
          <td style="text-align: center; font-size: 7.5pt;">${it.um || 'buc'}</td>
          <td style="text-align: right;">${(parseFloat(it.suprafata) || 0).toFixed(2)}</td>
          <td style="text-align: right;">${(parseFloat(it.pretUnitar) || 0).toFixed(2)} €</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a;">${(parseFloat(it.valoareTotala) || 0).toFixed(2)} €</td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="11" style="text-align: center; padding: 15px; color: #64748b;">Nu există articole în această comandă.</td></tr>`;

    container.innerHTML = `
      <div class="print-doc-container">
        <div class="print-header-bar">
          <div class="print-header-left">
            <img src="kronvent-logo.png" alt="KronVent Brașov" class="print-logo">
            <div class="print-company-details">
              <div class="company-name">KRONVENT TUBULATURĂ HVAC S.R.L.</div>
              <div class="company-line">Fabrică & Centru Prelucrare Tablă Zincată • Brașov, România</div>
              <div class="company-line">CIF: RO 38472910 • Reg. Com: J08/1234/2018 • Capital Social: 50.000 RON</div>
              <div class="company-line">Comenzi & Suport Tehnic: 0725 003 187 • Email: adrian@kronvent.ro</div>
            </div>
          </div>
          <div class="print-header-right">
            <div class="doc-badge">SPECIFICAȚIE TEHNICĂ & OFERTĂ COMERCIALĂ</div>
            <table class="doc-meta-table">
              <tr><td>Nr. Ofertă:</td><td><strong>${orderNumber}</strong></td></tr>
              <tr><td>Data emiterii:</td><td><strong>${orderDate}</strong></td></tr>
              <tr><td>Curs BNR:</td><td><strong>1 EUR = ${cursBnr.toFixed(4)} RON</strong></td></tr>
              <tr><td>Valabilitate:</td><td><strong>30 de zile</strong></td></tr>
            </table>
          </div>
        </div>

        <div class="print-client-section">
          <div class="client-column">
            <div class="box-title">BENEFICIAR / DATE CUMPĂRĂTOR</div>
            <table class="box-meta-table">
              <tr><td>Companie:</td><td><strong>${clientName}</strong></td></tr>
              <tr><td>Contact / Tel:</td><td><strong>${contactTel}</strong></td></tr>
              <tr><td>Email:</td><td><strong>${contactEmail}</strong></td></tr>
            </table>
          </div>
          <div class="client-column">
            <div class="box-title">PROIECT & CONDIȚII LIVRARE</div>
            <table class="box-meta-table">
              <tr><td>Proiect / Șantier:</td><td><strong>${projectName}</strong></td></tr>
              <tr><td>Adresă Livrare:</td><td><strong>${deliveryAddress}</strong></td></tr>
              <tr><td>Regim TVA:</td><td><strong>${tvaRate}% (${tvaRate === 0 ? 'Taxare inversă conform Legii 227/2015' : 'Cota standard'})</strong></td></tr>
            </table>
          </div>
        </div>

        <div class="print-table-section">
          <table class="print-items-table">
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">Nr.</th>
                <th style="width: 45px; text-align: center;">Cod</th>
                <th>Denumire Piesă & Sistem HVAC</th>
                <th>Dimensiuni Tehnice (mm)</th>
                <th style="width: 50px; text-align: center;">Tablă</th>
                <th style="width: 60px; text-align: center;">Flanșă</th>
                <th style="width: 40px; text-align: right;">Cant.</th>
                <th style="width: 30px; text-align: center;">UM</th>
                <th style="width: 55px; text-align: right;">S.Tot(m²)</th>
                <th style="width: 65px; text-align: right;">Preț Unitar</th>
                <th style="width: 75px; text-align: right;">Valoare (€)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
            <tfoot>
              <tr class="print-totals-row">
                <td colspan="6" style="text-align: right; font-weight: 800;">TOTALURI SPECIFICAȚIE COMANDĂ:</td>
                <td style="text-align: right; font-weight: 800;">${Math.round(totalPieces)}</td>
                <td style="text-align: center; font-weight: 700;">buc</td>
                <td style="text-align: right; font-weight: 800;">${totalArea.toFixed(2)} m²</td>
                <td></td>
                <td style="text-align: right; font-weight: 800; color: #1e3a8a;">${totalPriceEur.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="print-footer-grid">
          <div class="print-terms-box">
            <div class="box-title">CONDIȚII TEHNICE & GARANȚIE PRODUCĂTOR</div>
            <ul class="terms-bullets">
              <li>Fabricație din tablă zincată calitatea DX51D + Z275 conform SR EN 10346, SR EN 1505 și SR EN 1506.</li>
              <li>Clasă de etanșeitate garantată: ATC 3 (Clasa B / C conform SR EN 1507 și SR EN 12237).</li>
              <li>Piesele rectangulare includ profile de flanșă (FL20/FL30) montate mecanic și colțari etanșați cu mastic acrilic.</li>
              <li>Termen de producție asigurat: 3 - 5 zile lucrătoare de la confirmarea prezentei oferte.</li>
              <li>Livrare: Franco Depozit Brașov sau transport asigurat pe șantier la cerere.</li>
            </ul>
          </div>

            <div class="print-financial-box">
            <div class="fin-row">
              <span>Valoare Fără TVA:</span>
              <strong>${totalPriceEur.toFixed(2)} €</strong>
              <small>(${totalPriceRon.toFixed(2)} RON)</small>
            </div>
            <div class="fin-row">
              <span>TVA (${tvaRate}%):</span>
              <strong>${tvaValEur.toFixed(2)} €</strong>
              <small>(${tvaValRon.toFixed(2)} RON)</small>
            </div>
            <div class="fin-grand-total">
              <div class="total-label">TOTAL GENERAL COMANDĂ:</div>
              <div class="total-eur">${grandTotalEur.toFixed(2)} €</div>
              <div class="total-ron">${grandTotalRon.toFixed(2)} RON (TVA inclus)</div>
            </div>
          </div>
        </div>

        <div class="print-signatures">
          <div class="sig-block">
            <div class="sig-title">ÎNTOCMIT PRODUCĂTOR:</div>
            <div class="sig-person">Ing. Adrian Popa</div>
            <div class="sig-post">Șef Fabrică & Ofertare KronVent</div>
            <div class="sig-stamp-line">Semnătura & Ștampila Fabricii</div>
          </div>
          <div class="sig-block">
            <div class="sig-title">CONFIRMAT BENEFICIAR / CLIENT:</div>
            <div class="sig-person">${clientName}</div>
            <div class="sig-post">Reprezentant Legal / Achiziții</div>
            <div class="sig-stamp-line">Semnătura & Ștampila de Primire</div>
          </div>
        </div>
      </div>
    `;
  };

  const handlePrint = () => {
    window.prepareOfficialPrintDocument();
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const btnPrint = document.getElementById('btn-print');
  if (btnPrint) btnPrint.addEventListener('click', handlePrint);

  const btnCartPrint = document.getElementById('btn-cart-print');
  if (btnCartPrint) btnCartPrint.addEventListener('click', handlePrint);

  const btnCheckoutPrint = document.getElementById('btn-checkout-print');
  if (btnCheckoutPrint) btnCheckoutPrint.addEventListener('click', handlePrint);

  const btnSuccessPrint = document.getElementById('btn-success-print');
  if (btnSuccessPrint) {
    btnSuccessPrint.removeAttribute('onclick');
    btnSuccessPrint.addEventListener('click', handlePrint);
  }

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) btnReset.addEventListener('click', resetProjectData);

  const btnQuickAdd = document.getElementById('btn-quick-add');
  if (btnQuickAdd) {
    btnQuickAdd.addEventListener('click', () => {
      if (typeof window.goToStep === 'function') window.goToStep(1);
    });
  }

  const btnClearCart = document.getElementById('btn-clear-cart');
  if (btnClearCart) {
    btnClearCart.addEventListener('click', () => window.clearCart());
  }

  const tbody = document.getElementById('items-tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.btn-delete-item');
      if (delBtn) {
        e.stopPropagation();
        e.preventDefault();
        const idx = parseInt(delBtn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) window.deleteItem(idx);
      }
    });
  }

  const btnAddOrder = document.getElementById('btn-add-item-to-order');
  if (btnAddOrder) btnAddOrder.addEventListener('click', addItemToOrder);

  const orderTvaSelect = document.getElementById('order-tva-select');
  if (orderTvaSelect) {
    orderTvaSelect.addEventListener('change', (e) => {
      state.settings.tva = parseFloat(e.target.value) || 0;
      const settingTvaInput = document.getElementById('setting-tva');
      if (settingTvaInput) settingTvaInput.value = state.settings.tva;
      updateTableTotalsRow();
    });
  }

  const btnSubmit = document.getElementById('btn-submit-order');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      if (!state.items || state.items.length === 0) {
        showToast('Coșul de comandă este gol. Vă rugăm adăugați piese din configurator sau importați un fișier Excel!', 'warning');
        return;
      }

      const clientName = document.getElementById('order-client')?.value?.trim() || 'Beneficiar Nespecificat';
      const projectName = document.getElementById('order-proiect')?.value?.trim() || 'Proiect Tubulatură HVAC';
      const tel = document.getElementById('order-contact-tel')?.value?.trim() || '';
      const email = document.getElementById('order-contact-email')?.value?.trim() || '';
      const adresa = document.getElementById('order-adresa')?.value?.trim() || '';
      const orderNum = document.getElementById('order-numar')?.value?.trim() || `CMD-${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
      const orderDate = document.getElementById('order-data')?.value?.trim() || new Date().toLocaleDateString('ro-RO');

      state.meta.client = clientName;
      state.meta.subiect = projectName;
      state.meta.telefon = tel;
      state.meta.email = email;
      state.meta.adresa = adresa;
      state.meta.numar = orderNum;
      state.meta.data = orderDate;

      const totalValoareEur = state.items.reduce((acc, it) => acc + (parseFloat(it.valoareTotala) || 0), 0);
      const totalPieces = state.items.reduce((acc, it) => acc + (parseFloat(it.cantitate) || 0), 0);
      const totalSurface = state.items.reduce((acc, it) => acc + (parseFloat(it.suprafata) || 0), 0);
      const totalRon = totalValoareEur * (state.settings.cursEur || 5.2542);

      const orderPayload = {
        client: clientName,
        project: projectName,
        date: orderDate,
        totalEur: parseFloat(totalValoareEur.toFixed(2)),
        totalRon: parseFloat(totalRon.toFixed(2)),
        totalMp: parseFloat(totalSurface.toFixed(2)),
        totalPiese: totalPieces,
        calculation_snapshot: {
          timestamp: new Date().toISOString(),
          settings: JSON.parse(JSON.stringify(state.settings)),
          cursEur: state.settings.cursEur,
          pretMpRectangular: state.settings.pretMpRectangular,
          tva: state.settings.tva,
          itemsCount: state.items.length
        },
        items: state.items.map(it => ({
          nr: it.nr,
          eticheta: it.eticheta,
          categorie: it.categorie,
          cod: it.cod,
          dimensiuni: it.dimensiuni,
          cantitate: it.cantitate,
          sUnit: it.sUnit,
          suprafata: it.suprafata,
          pretUnitar: it.pretUnitar,
          valoareTotala: it.valoareTotala,
          flansa: it.flansa,
          grosime: it.grosime,
          greutate: it.greutate
        }))
      };

      try {
        const resOrder = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload)
        });

        const result = await resOrder.json();
        if (result.success) {
          const registeredNum = result.order?.id || result.order?.orderNumber || orderNum;

          const elNum = document.getElementById('success-cmd-num');
          if (elNum) elNum.textContent = registeredNum;
          const elP = document.getElementById('success-cmd-pieces');
          if (elP) elP.textContent = `${Math.round(totalPieces)} bucăți`;
          const elS = document.getElementById('success-cmd-surface');
          if (elS) elS.textContent = `${totalSurface.toFixed(2)} m²`;
          const elV = document.getElementById('success-cmd-val');
          if (elV) elV.textContent = `${totalValoareEur.toFixed(2)} € (${totalRon.toFixed(2)} RON)`;

          const modalSuccess = document.getElementById('order-success-modal');
          if (modalSuccess) modalSuccess.classList.add('open');

          // Reset local cart to clean state after successful order transmission
          state.items = [];
          localStorage.removeItem('kronvent_client_cart');
          applyFiltersAndRender();
          updateKPICards();
          updateAtelierTab();

          // Realtime notify factory admin panel
          if (typeof BroadcastChannel !== 'undefined') {
            try {
              const syncChannel = new BroadcastChannel('kronvent_sync');
              syncChannel.postMessage({ type: 'NEW_ORDER', order: result.order });
            } catch (e) {}
          }

          showToast(`Comanda ${registeredNum} a fost transmisă fabricii cu succes!`, 'success');
        } else {
          showToast('Eroare la transmiterea comenzii: ' + (result.error || 'Server error'), 'error');
        }
      } catch (err) {
        showToast('Eroare rețea la transmiterea comenzii: ' + err.message, 'error');
      }
    });
  }

  const btnSuccessClose = document.getElementById('btn-success-close');
  if (btnSuccessClose) {
    btnSuccessClose.addEventListener('click', () => {
      const modalSuccess = document.getElementById('order-success-modal');
      if (modalSuccess) modalSuccess.classList.remove('open');
    });
  }

  const btnSaveSettings = document.getElementById('btn-save-settings');
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      const pMp = document.getElementById('setting-pret-mp');
      const cEur = document.getElementById('setting-curs-eur');
      const sTva = document.getElementById('setting-tva');

      if (pMp) state.settings.pretMpRectangular = parseFloat(pMp.value) || 15.0;
      if (cEur) state.settings.cursEur = parseFloat(cEur.value) || 4.97;
      if (sTva) state.settings.tva = parseFloat(sTva.value) || 21;
      
      const sel = document.getElementById('order-tva-select');
      if (sel) sel.value = state.settings.tva;

      // Recalculate rectangular prices
      state.items.forEach(it => {
        if (it.categorie !== 'Tubulatura Circulara Spiro' && it.suprafata) {
          it.pretUnitar = parseFloat((it.sUnit * state.settings.pretMpRectangular).toFixed(2));
          it.valoareTotala = parseFloat((it.suprafata * state.settings.pretMpRectangular).toFixed(2));
        }
      });

      applyFiltersAndRender();
      updateKPICards();
      showToast('Setările de preț au fost actualizate!');
    });
  }
}

// ====================================================================
// DATA LOADING & ENRICHMENT WITH 15 €/m²
// ====================================================================
// Helper pentru persistența sigură a coșului clientului în localStorage
function saveCartToStorage() {
  try {
    localStorage.setItem('kronvent_client_cart', JSON.stringify(state.items));
  } catch (e) {
    console.warn('Nu s-a putut salva coșul local:', e);
  }
}

// Încărcare la cerere a proiectului demonstrativ (51 piese)
window.loadDemoProject = async function() {
  try {
    showToast('Se încarcă modelul demonstrativ (51 piese)...', 'info');
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Nu s-au putut încărca datele demo');
    const data = await res.json();
    
    if (data.meta) {
      const elClient = document.getElementById('order-client');
      if (elClient) elClient.value = data.meta.client || 'RADOIA ISOLIRUNG';
      const elProiect = document.getElementById('order-proiect');
      if (elProiect) elProiect.value = data.meta.subiect || 'Oferta HVAC HOTEL VALIUG';
    }

    state.items = (data.items || []).map((it, idx) => enrichItemData(it, idx + 1));
    saveCartToStorage();
    applyFiltersAndRender();
    updateKPICards();
    updateAtelierTab();
    showToast(`Modelul demonstrativ cu ${state.items.length} poziții a fost încărcat în coș!`, 'success');
  } catch (err) {
    showToast('Eroare la încărcarea modelului demo: ' + err.message, 'error');
  }
};

// ====================================================================
// DATA LOADING & SESSION RESTORE (CLEAN CLIENT CART BY DEFAULT)
// ====================================================================
async function loadInitialData() {
  try {
    // 1. Dynamic Active Year Parameters from Backend
    try {
      const resParams = await fetch('/api/parameters');
      if (resParams.ok) {
        const pData = await resParams.json();
        if (pData.settings) {
          Object.assign(state.settings, pData.settings);
        }
      }
    } catch (e) {
      console.warn('Nu s-au putut încărca parametrii dinamici:', e);
    }

    // 2. Data curentă oficială și număr secvențial de comandă
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}.${mm}.${yyyy}`;

    let nextOrderNum = `CMD-${yyyy}-00001`;
    try {
      const resOrders = await fetch('/api/orders');
      if (resOrders.ok) {
        const orders = await resOrders.json();
        const nextIdx = (Array.isArray(orders) ? orders.length : 0) + 1;
        nextOrderNum = `CMD-${yyyy}-${String(nextIdx).padStart(5, '0')}`;
      }
    } catch (e) {
      console.warn('Eroare determinare număr secvențial comandă:', e);
    }

    state.meta = {
      furnizor: 'KronVent Brașov',
      client: '',
      subiect: '',
      numar: nextOrderNum,
      data: todayStr,
      telefon: '',
      email: '',
      adresa: ''
    };

    const elNumar = document.getElementById('order-numar');
    if (elNumar && !elNumar.value) elNumar.value = nextOrderNum;

    const elData = document.getElementById('order-data');
    if (elData && !elData.value) elData.value = todayStr;

    // 3. Restaurare coș din sesiunea locală a utilizatorului (sau inițializare cu coș gol)
    const savedCartJson = localStorage.getItem('kronvent_client_cart');
    if (savedCartJson) {
      try {
        const savedItems = JSON.parse(savedCartJson);
        if (Array.isArray(savedItems) && savedItems.length > 0) {
          state.items = savedItems.map((it, idx) => enrichItemData(it, idx + 1));
        } else {
          state.items = [];
        }
      } catch (e) {
        state.items = [];
      }
    } else {
      state.items = []; // Coș curat pentru clienți noi!
    }

    applyFiltersAndRender();
    updateKPICards();
    updateAtelierTab();
  } catch (err) {
    console.error('Error loading initial data:', err);
  }
}

// Sincronizare în timp real între ferestre (fără a suprascrie coșul clientului)
function setupRealtimeSync() {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const syncChannel = new BroadcastChannel('kronvent_sync');
      syncChannel.onmessage = async (e) => {
        if (e.data && e.data.type === 'PARAMETERS_UPDATED') {
          console.log('[SYNC] Parametrii comerciali s-au actualizat de către fabrică!');
          try {
            const resParams = await fetch('/api/parameters');
            if (resParams.ok) {
              const pData = await resParams.json();
              if (pData.settings) {
                Object.assign(state.settings, pData.settings);
                state.items = state.items.map((it, idx) => enrichItemData(it, idx + 1));
                applyFiltersAndRender();
                updateKPICards();
                updateAtelierTab();
              }
            }
          } catch (err) {}
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }
}

function enrichItemData(it, nr) {
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

  // Compute price if missing (using 15 €/m²)
  let valoareTotala = it.valoareTotala;
  let pretUnitar = it.pretUnitar;

  if (valoareTotala === undefined) {
    if (isMounting) {
      pretUnitar = 0.5; // accesorii preț estimat
      valoareTotala = cant * pretUnitar;
    } else {
      pretUnitar = sUnit * state.settings.pretMpRectangular;
      valoareTotala = sTot * state.settings.pretMpRectangular;
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

// ====================================================================
// TABLE RENDERING WITH ROWS SELECTOR & MANDATORY TOTALS ROW
// ====================================================================
function applyFiltersAndRender() {
  state.filteredItems = state.items.filter(it => {
    const s = state.filters.search;
    const matchSearch = !s || 
      (it.eticheta && it.eticheta.toLowerCase().includes(s)) ||
      (it.cod && it.cod.toLowerCase().includes(s)) ||
      (it.dimensiuni && it.dimensiuni.toLowerCase().includes(s)) ||
      (it.categorie && it.categorie.toLowerCase().includes(s));

    const matchCat = !state.filters.category || it.categorie === state.filters.category;
    const matchFlange = !state.filters.flange || it.flansa === state.filters.flange;

    return matchSearch && matchCat && matchFlange;
  });

  renderTable();
  renderPagination();
  updateTableTotalsRow();
}

function renderTable() {
  const tbody = document.getElementById('items-tbody');
  tbody.innerHTML = '';

  const total = state.filteredItems.length;
  if (total === 0) {
    if (!state.items || state.items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="14" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
            <div style="max-width: 440px; margin: 0 auto;">
              <svg style="width: 48px; height: 48px; color: var(--text-muted); opacity: 0.5; margin-bottom: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              <div style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">Coșul de comandă este gol (0 poziții)</div>
              <p style="font-size: 13px; line-height: 1.5; color: var(--text-secondary); margin-bottom: 18px;">Puteți adăuga piese din configurator, importa direct un extras Excel de proiect (.xlsx) sau încărca un model demonstrativ de test.</p>
              <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button onclick="document.getElementById('step1-toggle')?.click()" class="k-btn k-btn-primary k-btn-sm" type="button">+ Deschide Configurator</button>
                <button onclick="document.getElementById('client-excel-input')?.click()" class="k-btn k-btn-secondary k-btn-sm" type="button">📁 Import Excel (.xlsx)</button>
                <button onclick="window.loadDemoProject()" class="k-btn k-btn-secondary k-btn-sm" type="button" style="font-size: 11px; opacity: 0.85;">Model Demo (51 piese)</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="14" style="text-align: center; padding: 40px; color: var(--text-muted);">
            Nu a fost găsită nicio piesă conform căutării sau filtrelor selectate.
          </td>
        </tr>
      `;
    }
    return;
  }

  const start = (state.currentPage - 1) * state.rowsPerPage;
  const end = Math.min(start + state.rowsPerPage, total);
  const pageItems = state.filteredItems.slice(start, end);

  pageItems.forEach((it, idx) => {
    const currentAbsIndex = state.items.indexOf(it);
    const tr = document.createElement('tr');

    const badgeFlansa = it.flansa === 'FLANSA30' 
      ? `<span class="k-badge badge-flansa30">FLANSA 30</span>` 
      : `<span class="k-badge badge-flansa20">${it.flansa || '-'}</span>`;

    tr.innerHTML = `
      <td style="text-align: center; font-weight: 700; color: #2563eb;">${start + idx + 1}</td>
      <td style="text-align: center; white-space: nowrap;">
        <button class="k-btn k-btn-secondary k-btn-xs" onclick="window.openEditModal(${currentAbsIndex})" title="Editează piesa" style="padding: 3px 6px; margin-right: 3px; font-size: 11px;">
          <svg class="icon-svg" viewBox="0 0 24 24" style="width: 13px; height: 13px; vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="k-btn k-btn-danger k-btn-xs btn-delete-item" data-index="${currentAbsIndex}" onclick="window.deleteItem(${currentAbsIndex})" title="Șterge piesa din comandă" style="padding: 3px 6px; background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
          <svg class="icon-svg" viewBox="0 0 24 24" style="width: 13px; height: 13px; vertical-align: middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
      <td><strong style="color: #0f172a;">${it.eticheta || '-'}</strong></td>
      <td><span style="font-size: 11px; color: #475569;">${it.categorie || '-'}</span></td>
      <td style="text-align: center;"><span class="k-badge badge-code">${it.cod || '-'}</span></td>
      <td style="font-weight: 600; color: #1e3a8a;">${it.dimensiuni || '-'}</td>
      <td style="text-align: center; color: #475569;">${it.um || 'buc'}</td>
      <td style="text-align: right; font-weight: 700; color: #0f172a;">${it.cantitate}</td>
      <td style="text-align: right; color: #334155;">${it.sUnit ? it.sUnit.toFixed(4) : '-'}</td>
      <td style="text-align: right; font-weight: 700; color: #15803d;">${it.suprafata ? it.suprafata.toFixed(4) : '-'}</td>
      <td style="text-align: right; color: #334155;">${it.pretUnitar ? it.pretUnitar.toFixed(2) + ' €' : '-'}</td>
      <td style="text-align: right; font-weight: 700; color: #0f172a;">${it.valoareTotala ? it.valoareTotala.toFixed(2) + ' €' : '0.00 €'}</td>
      <td style="text-align: center;">${badgeFlansa}</td>
      <td style="text-align: center; color: #334155;">${it.grosime ? it.grosime + ' mm' : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Update the Mandatory Totals Row (Rând de Totaluri)
function updateTableTotalsRow() {
  const items = state.filteredItems;
  const totCant = items.reduce((acc, it) => acc + (parseFloat(it.cantitate) || 0), 0);
  const totSuprafata = items.reduce((acc, it) => acc + (parseFloat(it.suprafata) || 0), 0);
  const totValoareEur = items.reduce((acc, it) => acc + (parseFloat(it.valoareTotala) || 0), 0);
  const totGreutate = items.reduce((acc, it) => acc + (parseFloat(it.greutate) || 0), 0);

  const totValoareRon = totValoareEur * state.settings.cursEur;
  const tvaEur = totValoareEur * (state.settings.tva / 100);
  const totCuTvaEur = totValoareEur + tvaEur;

  // Footer Row Elements
  document.getElementById('foot-cantitate').textContent = `${Math.round(totCant)} buc`;
  document.getElementById('foot-suprafata').textContent = `${totSuprafata.toFixed(2)} m²`;
  document.getElementById('foot-valoare').textContent = `${totValoareEur.toFixed(2)} € (${totValoareRon.toFixed(2)} RON)`;
  document.getElementById('foot-greutate').textContent = `Greutate totală: ${totGreutate.toFixed(1)} kg`;

  // Summary Banner
  document.getElementById('summary-total-eur').textContent = `${totValoareEur.toFixed(2)} € / ${totValoareRon.toFixed(2)} RON`;
  document.getElementById('summary-total-tva').textContent = `TVA (${state.settings.tva}%): ${tvaEur.toFixed(2)} € | Total cu TVA: ${totCuTvaEur.toFixed(2)} € (${(totCuTvaEur * state.settings.cursEur).toFixed(2)} RON)`;

  document.getElementById('filter-count-badge').textContent = items.length;
}

function renderPagination() {
  const container = document.getElementById('pagination-buttons');
  const info = document.getElementById('pagination-info');
  container.innerHTML = '';

  const total = state.filteredItems.length;
  if (total === 0) {
    info.textContent = '0 înregistrări';
    return;
  }

  const totalPages = Math.ceil(total / state.rowsPerPage) || 1;
  const start = (state.currentPage - 1) * state.rowsPerPage + 1;
  const end = Math.min(state.currentPage * state.rowsPerPage, total);

  info.textContent = `Se afișează ${start} - ${end} din ${total} înregistrări`;

  // Prev
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-pill';
  prevBtn.innerHTML = '&laquo;';
  prevBtn.disabled = state.currentPage === 1;
  prevBtn.onclick = () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      applyFiltersAndRender();
    }
  };
  container.appendChild(prevBtn);

  // Pages
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= state.currentPage - 2 && p <= state.currentPage + 2)) {
      const btn = document.createElement('button');
      btn.className = `page-pill ${p === state.currentPage ? 'active' : ''}`;
      btn.textContent = p;
      btn.onclick = () => {
        state.currentPage = p;
        applyFiltersAndRender();
      };
      container.appendChild(btn);
    }
  }

  // Next
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-pill';
  nextBtn.innerHTML = '&raquo;';
  nextBtn.disabled = state.currentPage === totalPages;
  nextBtn.onclick = () => {
    if (state.currentPage < totalPages) {
      state.currentPage++;
      applyFiltersAndRender();
    }
  };
  container.appendChild(nextBtn);
}

// Update Top KPI Cards
function updateKPICards() {
  const totalSurface = state.items.reduce((acc, it) => acc + (parseFloat(it.suprafata) || 0), 0);
  const totalPieces = state.items.reduce((acc, it) => acc + (parseFloat(it.cantitate) || 0), 0);
  const totalValoareEur = state.items.reduce((acc, it) => acc + (parseFloat(it.valoareTotala) || 0), 0);
  const totalGreutate = state.items.reduce((acc, it) => acc + (parseFloat(it.greutate) || 0), 0);

  const tvaEur = totalValoareEur * (state.settings.tva / 100);
  const totCuTvaEur = totalValoareEur + tvaEur;
  const totCuTvaRon = totCuTvaEur * state.settings.cursEur;

  const elVal = document.getElementById('kpi-valoare-totala');
  if (elVal) elVal.textContent = `${totalValoareEur.toFixed(2)} €`;

  const elRon = document.getElementById('kpi-valoare-ron');
  if (elRon) elRon.textContent = `${(totalValoareEur * state.settings.cursEur).toFixed(2)} RON (fără TVA)`;

  const elTotTva = document.getElementById('kpi-total-cu-tva');
  if (elTotTva) elTotTva.textContent = `${totCuTvaEur.toFixed(2)} €`;

  const elTotTvaRon = document.getElementById('kpi-total-cu-tva-ron');
  if (elTotTvaRon) elTotTvaRon.textContent = `${totCuTvaRon.toFixed(2)} RON (TVA ${state.settings.tva}%)`;

  const elSup = document.getElementById('kpi-suprafata');
  if (elSup) elSup.textContent = `${totalSurface.toFixed(2)} m²`;

  const elP = document.getElementById('kpi-piese');
  if (elP) elP.textContent = `${Math.round(totalPieces)} bucăți`;

  const elG = document.getElementById('kpi-greutate');
  if (elG) elG.textContent = `${totalGreutate.toFixed(1)} kg`;

  const uniqueCats = new Set(state.items.map(it => it.categorie).filter(Boolean));
  const elCats = document.getElementById('kpi-categorii-count');
  if (elCats) elCats.textContent = `${uniqueCats.size} poziții distincte`;

  const cartBadge = document.getElementById('cart-count-badge');
  if (cartBadge) cartBadge.textContent = state.items.length;
  if (typeof updateStep1SummaryBanner === 'function') updateStep1SummaryBanner();
}

// ====================================================================
// CONFIGURATOR & DYNAMIC INPUTS & LIVE BLUEPRINT
// ====================================================================
function renderPieceForm() {
  const configs = state.activeCategoryMode === 'RECTANGULAR' ? RECTANGULAR_CONFIGS : CIRCULAR_CONFIGS;
  const config = configs[state.currentPieceType] || Object.values(configs)[0];
  const container = document.getElementById('dynamic-inputs-container');
  container.innerHTML = '';

  config.fields.forEach(f => {
    const group = document.createElement('div');
    group.className = 'input-field-group';

    if (f.type === 'select') {
      const isDiam = f.id === 'dim_D' || f.id === 'dim_D1' || f.id === 'dim_D2' || f.label.includes('Ø') || f.label.toLowerCase().includes('diametru');
      const unitLabel = f.unit || (isDiam ? 'mm' : 'buc');
      const optionsHtml = f.options.map(opt => {
        const text = isDiam ? `Ø ${opt} mm` : `${opt} ${unitLabel}`;
        return `<option value="${opt}" ${opt === f.default ? 'selected' : ''}>${text}</option>`;
      }).join('');
      group.innerHTML = `
        <label for="${f.id}">
          <span class="field-title" title="${f.label}">${f.label}</span>
          <span class="unit-pill">${f.unit || (isDiam ? 'mm' : 'buc')}</span>
        </label>
        <select id="${f.id}" class="mac-input calc-param-input">${optionsHtml}</select>
      `;
    } else {
      group.innerHTML = `
        <label for="${f.id}">
          <span class="field-title">${f.label}</span>
          <span class="unit-pill">${f.unit || 'mm'}</span>
        </label>
        <input type="number" id="${f.id}" class="mac-input calc-param-input" value="${f.default}" min="${f.min || 0}" step="${f.step || 10}">
      `;
    }
    container.appendChild(group);
  });

  document.querySelectorAll('.calc-param-input').forEach(el => {
    el.addEventListener('input', updateLiveCalculation);
    el.addEventListener('change', updateLiveCalculation);
  });
  const cantInput = document.getElementById('input-cantitate');
  if (cantInput) cantInput.addEventListener('input', updateLiveCalculation);

  setupBlueprintZoomModal();
  updateLiveCalculation();
}

function setupBlueprintZoomModal() {
  const zoomModal = document.getElementById('blueprint-zoom-modal');
  if (!zoomModal) return;

  const btnClose = document.getElementById('zoom-modal-close-btn');
  const btnOk = document.getElementById('zoom-modal-ok-btn');
  const btnZoom = document.getElementById('btn-zoom-blueprint');
  const canvasBox = document.getElementById('blueprint-canvas-box');

  const closeModal = () => zoomModal.classList.remove('open');
  if (btnClose && !btnClose._bound) {
    btnClose._bound = true;
    btnClose.addEventListener('click', closeModal);
  }
  if (btnOk && !btnOk._bound) {
    btnOk._bound = true;
    btnOk.addEventListener('click', closeModal);
  }
  if (!zoomModal._boundOverlay) {
    zoomModal._boundOverlay = true;
    zoomModal.addEventListener('click', (e) => {
      if (e.target === zoomModal) closeModal();
    });
  }

  const triggerZoom = () => {
    const configs = state.activeCategoryMode === 'RECTANGULAR' ? RECTANGULAR_CONFIGS : CIRCULAR_CONFIGS;
    const config = configs[state.currentPieceType];
    if (!config) return;
    const params = getFormParameters();
    openBlueprintZoomModal(config, params);
  };

  if (btnZoom && !btnZoom._bound) {
    btnZoom._bound = true;
    btnZoom.addEventListener('click', triggerZoom);
  }

  if (canvasBox && !canvasBox._bound) {
    canvasBox._bound = true;
    canvasBox.addEventListener('click', triggerZoom);
  }
}

function openBlueprintZoomModal(config, params) {
  const modal = document.getElementById('blueprint-zoom-modal');
  if (!modal) return;

  const imgEl = document.getElementById('zoom-modal-img');
  const titleEl = document.getElementById('zoom-modal-piece-title');
  const badgesContainer = document.getElementById('zoom-modal-dim-badges');
  const summaryContainer = document.getElementById('zoom-modal-calc-summary');

  if (imgEl) {
    imgEl.src = config.cadImage || 'assets/icons3d/CRD.png';
    imgEl.alt = `${config.code} - ${config.name}`;
  }

  if (titleEl) {
    titleEl.textContent = `${config.code} — ${config.name} (${config.category})`;
  }

  if (badgesContainer && config.fields) {
    badgesContainer.innerHTML = config.fields.map(f => {
      const val = params[f.id] !== undefined ? params[f.id] : f.default;
      const match = f.label.match(/\(([^)]+)\)/);
      const letter = match ? match[1] : f.id.replace('dim_', '');
      return `
        <div class="cad-dim-pill" style="font-size: 13px; padding: 6px 14px;" title="${f.label}">
          <span class="dim-arrow">◄—</span>
          <strong class="dim-letter">${letter}</strong> (${f.label.split('(')[0].trim()}): 
          <span class="dim-val">${val} ${f.unit || 'mm'}</span>
          <span class="dim-arrow">—►</span>
        </div>
      `;
    }).join('');
  }

  if (summaryContainer && config.calc) {
    const res = config.calc(params, state.settings.pretMpRectangular || 15);
    summaryContainer.innerHTML = `
      <div class="zoom-spec-item">
        <span>Suprafață Calculată</span>
        <strong>${res.sTot.toFixed(3)} m²</strong>
      </div>
      <div class="zoom-spec-item">
        <span>Grosime Tablă</span>
        <strong>${res.grosime} mm</strong>
      </div>
      <div class="zoom-spec-item">
        <span>Tip Flanșă</span>
        <strong>${res.flansa}</strong>
      </div>
      <div class="zoom-spec-item">
        <span>Greutate Tablă</span>
        <strong>~${res.greutate.toFixed(1)} kg</strong>
      </div>
      <div class="zoom-spec-item">
        <span>Preț Estimat</span>
        <strong style="color: var(--industrial-green);">${res.valoareTotala.toFixed(2)} €</strong>
      </div>
    `;
  }

  modal.classList.add('open');
}

function getFormParameters() {
  const configs = state.activeCategoryMode === 'RECTANGULAR' ? RECTANGULAR_CONFIGS : CIRCULAR_CONFIGS;
  const config = configs[state.currentPieceType];
  const params = {
    cant: parseFloat(document.getElementById('input-cantitate').value) || 1
  };
  config.fields.forEach(f => {
    const el = document.getElementById(f.id);
    params[f.id] = el ? parseFloat(el.value) || f.default : f.default;
  });
  return params;
}

function updateLiveCalculation() {
  const configs = state.activeCategoryMode === 'RECTANGULAR' ? RECTANGULAR_CONFIGS : CIRCULAR_CONFIGS;
  const config = configs[state.currentPieceType];
  if (!config) return;

  const params = getFormParameters();
  const res = config.calc(params, state.settings.pretMpRectangular);

  const elPrice = document.getElementById('live-price-eur');
  if (elPrice) elPrice.textContent = `${res.valoareTotala.toFixed(2)} € (${(res.valoareTotala * state.settings.cursEur).toFixed(2)} RON)`;

  const elSup = document.getElementById('live-spec-suprafata') || document.getElementById('live-suprafata-val');
  if (elSup) elSup.textContent = `${res.sTot.toFixed(3)} m²`;

  const elUnit = document.getElementById('live-spec-unitar') || document.getElementById('live-pret-unitar');
  if (elUnit) elUnit.textContent = `${res.pretUnitar.toFixed(2)} € / ${res.um || 'buc'}`;

  const elGros = document.getElementById('live-spec-grosime') || document.getElementById('live-grosime-val');
  if (elGros) elGros.textContent = `${res.grosime} mm`;

  const elFlansa = document.getElementById('live-spec-flansa') || document.getElementById('live-flansa-val');
  if (elFlansa) elFlansa.textContent = res.flansa;

  const elColt = document.getElementById('live-spec-coltari') || document.getElementById('live-coltari-val');
  if (elColt) elColt.textContent = `${res.coltari} buc`;

  const elGreut = document.getElementById('live-spec-greutate') || document.getElementById('live-greutate-val');
  if (elGreut) elGreut.textContent = `${res.greutate.toFixed(1)} kg`;

  const elTag = document.getElementById('blueprint-code-tag') || document.getElementById('blueprint-label');
  if (elTag) elTag.textContent = `${config.code} - ${config.name.toUpperCase()}`;
  renderCADBlueprint(config, params);
}

function renderCADBlueprint(config, params) {
  const cadWrapper = document.getElementById('blueprint-cad-wrapper');
  const cadImg = document.getElementById('blueprint-cad-img');
  const dimBadges = document.getElementById('blueprint-dim-badges');
  const svg = document.getElementById('blueprint-svg');

  if (svg) svg.style.display = 'none';

  if (cadWrapper) cadWrapper.style.display = 'flex';
  if (cadImg) {
    cadImg.style.display = 'block';
    cadImg.src = (config && config.cadImage) ? config.cadImage : 'assets/icons3d/CRD.png';
    cadImg.alt = `${config ? config.code : 'HVAC'} - ${config ? config.name : 'Piesă'}`;
  }

  if (dimBadges && config && config.fields) {
    dimBadges.innerHTML = config.fields.map(f => {
      const val = params[f.id] !== undefined ? params[f.id] : f.default;
      const match = f.label.match(/\(([^)]+)\)/);
      const letter = match ? match[1] : f.id.replace('dim_', '');
      return `<div class="cad-dim-pill" title="${f.label}">
        <span class="dim-arrow">◄—</span> <strong class="dim-letter">${letter}</strong>: <span class="dim-val">${val} ${f.unit || 'mm'}</span> <span class="dim-arrow">—►</span>
      </div>`;
    }).join('');
    dimBadges.style.display = 'flex';
  }
}

function addItemToOrder() {
  const configs = state.activeCategoryMode === 'RECTANGULAR' ? RECTANGULAR_CONFIGS : CIRCULAR_CONFIGS;
  const config = configs[state.currentPieceType];
  if (!config) return;

  const params = getFormParameters();
  const res = config.calc(params, state.settings.pretMpRectangular);
  const sistem = document.getElementById('input-sistem').value || 'Tubulatura Ventilatie';

  const newItem = {
    nr: state.items.length + 1,
    categorie: config.category,
    eticheta: `${sistem}-${config.code}-${state.items.length + 1}`,
    sistem,
    cod: config.code,
    dimensiuni: res.dimText,
    um: res.um || 'buc',
    cantitate: res.cantitate || params.cant || 1,
    suprafata: res.sTot,
    sUnit: res.sUnit,
    pretUnitar: res.pretUnitar,
    valoareTotala: res.valoareTotala,
    grosime: res.grosime,
    flansa: res.flansa,
    coltari: res.coltari,
    greutate: res.greutate
  };

  state.items.push(newItem);
  saveCartToStorage();
  applyFiltersAndRender();
  updateKPICards();
  updateAtelierTab();
  if (typeof updateStep1SummaryBanner === 'function') updateStep1SummaryBanner();

  showToast(`Piesa "${config.name}" (${res.dimText}) a fost adăugată în coș!`, 'success');

  // Pulse next step container to highlight that the order is ready to proceed
  const nextBanner = document.getElementById('step1-next-container');
  if (nextBanner) {
    nextBanner.classList.add('pulse-highlight');
    setTimeout(() => nextBanner.classList.remove('pulse-highlight'), 1200);
  }
}

// 2D SVG Technical CAD Blueprint Render
function renderBlueprintSVG(type, p) {
  const svg = document.getElementById('blueprint-svg');
  if (!svg) return;
  svg.innerHTML = '';

  const stroke = '#1e3a8a';
  const strokeLight = '#2563eb';
  const fill = 'rgba(37, 99, 235, 0.08)';
  const dimColor = '#c2410c';
  const textColor = '#0f172a';

  const markerDef = `
    <defs>
      <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="${dimColor}" />
      </marker>
      <marker id="arr-rev" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 10 1.5 L 0 5 L 10 8.5 z" fill="${dimColor}" />
      </marker>
    </defs>
  `;

  let content = markerDef;

  if (type === 'CRD') {
    const A = p.dim_A || 500;
    const B = p.dim_B || 500;
    const L = p.dim_L || 1380;
    content += `
      <polygon points="60,70 160,40 160,160 60,190" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <polygon points="160,40 330,80 230,110 60,70" fill="rgba(37, 99, 235, 0.16)" stroke="${stroke}" stroke-width="2"/>
      <polygon points="160,160 160,40 330,80 330,200" fill="rgba(37, 99, 235, 0.06)" stroke="${stroke}" stroke-width="2"/>
      <line x1="50" y1="65" x2="150" y2="35" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="90" y="45" fill="${textColor}" font-size="12" font-weight="700">A=${A} mm</text>
      <line x1="45" y1="75" x2="45" y2="185" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="5" y="135" fill="${textColor}" font-size="12" font-weight="700">B=${B}</text>
      <line x1="170" y1="35" x2="340" y2="75" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="245" y="50" fill="${textColor}" font-size="12" font-weight="700">L=${L} mm</text>
    `;
  } else if (type === 'CR') {
    const A1 = p.dim_A1 || 500;
    const A2 = p.dim_A2 || 500;
    const B = p.dim_B || 300;
    const R = p.dim_R || 150;
    const unghi = p.dim_Unghi || 90;
    content += `
      <path d="M 60,180 L 140,180 A 100,100 0 0 0 240,80 L 240,40 L 190,40 A 150,150 0 0 1 60,130 Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <line x1="60" y1="195" x2="140" y2="195" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="80" y="212" fill="${textColor}" font-size="11" font-weight="700">A1=${A1}</text>
      <line x1="255" y1="40" x2="255" y2="80" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="260" y="65" fill="${textColor}" font-size="11" font-weight="700">A2=${A2}</text>
      <text x="140" y="130" fill="${dimColor}" font-size="12" font-weight="700">R=${R} | ${unghi}°</text>
      <text x="60" y="110" fill="${textColor}" font-size="11" font-weight="700">H(B)=${B}</text>
    `;
  } else if (type === 'TR') {
    const A = p.dim_A || 800;
    const B = p.dim_B || 400;
    const C = p.dim_C || 500;
    content += `
      <polygon points="50,130 350,130 350,170 50,170" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <polygon points="160,50 240,50 240,130 160,130" fill="rgba(37, 99, 235, 0.14)" stroke="${stroke}" stroke-width="2"/>
      <line x1="50" y1="185" x2="350" y2="185" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="175" y="202" fill="${textColor}" font-size="11" font-weight="700">Tronson A=${A}</text>
      <line x1="160" y1="35" x2="240" y2="35" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="180" y="30" fill="${textColor}" font-size="11" font-weight="700">C=${C}</text>
      <text x="55" y="115" fill="${textColor}" font-size="11" font-weight="700">H(B)=${B}</text>
    `;
  } else if (type === 'Red') {
    const A = p.dim_A || 800;
    const B = p.dim_B || 300;
    const C = p.dim_C || 500;
    const D = p.dim_D || 300;
    const L = p.dim_L || 300;
    content += `
      <polygon points="60,60 160,40 280,70 280,150 160,180 60,160" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <line x1="60" y1="60" x2="60" y2="160" stroke="${stroke}" stroke-width="2"/>
      <line x1="280" y1="70" x2="280" y2="150" stroke="${stroke}" stroke-width="2"/>
      <text x="15" y="115" fill="${textColor}" font-size="11" font-weight="700">${A}x${B}</text>
      <text x="290" y="115" fill="${textColor}" font-size="11" font-weight="700">${C}x${D}</text>
      <line x1="60" y1="195" x2="280" y2="195" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="150" y="212" fill="${textColor}" font-size="11" font-weight="700">L=${L} mm</text>
    `;
  } else if (type === 'Capac') {
    const A = p.dim_A || 400;
    const B = p.dim_B || 300;
    content += `
      <rect x="100" y="55" width="200" height="120" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <line x1="100" y1="55" x2="300" y2="175" stroke="${strokeLight}" stroke-width="1" stroke-dasharray="4,4"/>
      <line x1="300" y1="55" x2="100" y2="175" stroke="${strokeLight}" stroke-width="1" stroke-dasharray="4,4"/>
      <line x1="100" y1="40" x2="300" y2="40" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="180" y="32" fill="${textColor}" font-size="12" font-weight="700">A=${A}</text>
      <line x1="85" y1="55" x2="85" y2="175" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="50" y="120" fill="${textColor}" font-size="12" font-weight="700">B=${B}</text>
    `;
  } else if (type === 'CRDr') {
    const A1 = p.dim_A1 || 500;
    const A2 = p.dim_A2 || 500;
    const B = p.dim_B || 300;
    const R = p.dim_R || 150;
    content += `
      <path d="M 60,190 L 160,190 L 260,90 L 260,40 L 200,40 L 60,140 Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <line x1="60" y1="205" x2="160" y2="205" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="95" y="222" fill="${textColor}" font-size="11" font-weight="700">A1=${A1}</text>
      <line x1="275" y1="40" x2="275" y2="90" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="280" y="70" fill="${textColor}" font-size="11" font-weight="700">A2=${A2}</text>
      <text x="135" y="110" fill="${dimColor}" font-size="12" font-weight="700">Cot Drept R=${R}</text>
    `;
  } else if (type === 'CRDir') {
    const A1 = p.dim_A1 || 500;
    const A2 = p.dim_A2 || 500;
    const B = p.dim_B || 400;
    const R = p.dim_R || 150;
    const nDir = p.dim_Dirijori || 2;
    content += `
      <path d="M 60,180 L 140,180 A 100,100 0 0 0 240,80 L 240,40 L 190,40 A 150,150 0 0 1 60,130 Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <path d="M 85,180 A 115,115 0 0 0 240,55" fill="none" stroke="${strokeLight}" stroke-width="1.5" stroke-dasharray="3,3"/>
      <path d="M 115,180 A 130,130 0 0 0 240,70" fill="none" stroke="${strokeLight}" stroke-width="1.5" stroke-dasharray="3,3"/>
      <text x="70" y="205" fill="${textColor}" font-size="11" font-weight="700">A1=${A1}</text>
      <text x="110" y="125" fill="${dimColor}" font-size="12" font-weight="700">${nDir} Dirijori Aerodinamici</text>
    `;
  } else if (type === 'PDE') {
    const A = p.dim_A || 600;
    const B = p.dim_B || 300;
    const F = p.dim_F || 150;
    const L = p.dim_L || 800;
    content += `
      <polygon points="50,140 130,140 220,70 300,70 300,105 220,105 130,175 50,175" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <line x1="50" y1="185" x2="300" y2="185" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="160" y="205" fill="${textColor}" font-size="11" font-weight="700">L=${L} mm</text>
      <line x1="315" y1="70" x2="315" y2="140" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="320" y="110" fill="${textColor}" font-size="11" font-weight="700">Fuga F=${F}</text>
      <text x="60" y="130" fill="${textColor}" font-size="11" font-weight="700">${A}x${B}</text>
    `;
  } else if (type === 'YAKA') {
    const A = p.dim_A || 600;
    const B = p.dim_B || 300;
    const C = p.dim_C || 400;
    const L = p.dim_L || 150;
    content += `
      <rect x="60" y="140" width="280" height="50" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <rect x="130" y="60" width="140" height="80" fill="rgba(37,99,235,0.18)" stroke="${stroke}" stroke-width="2"/>
      <line x1="60" y1="205" x2="340" y2="205" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="180" y="222" fill="${textColor}" font-size="11" font-weight="700">Canal A=${A}</text>
      <line x1="130" y1="45" x2="270" y2="45" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="185" y="40" fill="${textColor}" font-size="11" font-weight="700">Gât C=${C}</text>
      <text x="280" y="105" fill="${dimColor}" font-size="11" font-weight="700">L=${L}</text>
    `;
  } else if (type === 'R2C') {
    content += `
      <path d="M 70,180 A 80,80 0 0 0 170,100 L 230,100 A 80,80 0 0 0 330,180" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <polygon points="170,100 230,100 230,190 170,190" fill="rgba(37,99,235,0.15)" stroke="${stroke}" stroke-width="2"/>
      <text x="130" y="75" fill="${textColor}" font-size="12" font-weight="700">Ramificație Bilaterală (2 Coturi)</text>
    `;
  } else if (type === 'RCC') {
    content += `
      <rect x="50" y="130" width="280" height="55" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <path d="M 160,130 A 60,60 0 0 1 240,60 L 270,60 L 270,90 A 30,30 0 0 0 240,130 Z" fill="rgba(37,99,235,0.18)" stroke="${stroke}" stroke-width="2"/>
      <text x="70" y="115" fill="${textColor}" font-size="11" font-weight="700">Cot Lateral pe Canal Tronson</text>
    `;
  } else if (type === 'RP') {
    content += `
      <polygon points="100,50 280,50 280,90 220,185 180,185 190,120 170,120 180,185 140,185 100,90" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <text x="140" y="35" fill="${textColor}" font-size="12" font-weight="700">Ramificație Pantalon</text>
    `;
  } else if (type === 'SSC' || type === 'SSE') {
    const d = p.dim_d || 250;
    const A = p.dim_A || 400;
    const B = p.dim_B || 300;
    const L = p.dim_L || 600;
    content += `
      <ellipse cx="100" cy="115" rx="30" ry="55" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <polygon points="240,70 320,50 320,160 240,180" fill="rgba(37,99,235,0.16)" stroke="${stroke}" stroke-width="2"/>
      <line x1="100" y1="60" x2="240" y2="70" stroke="${stroke}" stroke-width="2"/>
      <line x1="100" y1="170" x2="240" y2="180" stroke="${stroke}" stroke-width="2"/>
      <text x="50" y="120" fill="${textColor}" font-size="11" font-weight="700">Ø${d}</text>
      <text x="260" y="120" fill="${textColor}" font-size="11" font-weight="700">${A}x${B}</text>
      <line x1="100" y1="195" x2="240" y2="195" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="150" y="215" fill="${textColor}" font-size="11" font-weight="700">L=${L} mm</text>
    `;
  } else if (type === 'Plenum') {
    const A = p.dim_A || 400;
    const B = p.dim_B || 400;
    const H = p.dim_H || 350;
    const d = p.dim_d || 200;
    content += `
      <polygon points="70,90 170,60 300,75 300,155 200,185 70,160" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <polygon points="70,90 170,60 300,75 200,105" fill="rgba(37,99,235,0.15)" stroke="${stroke}" stroke-width="2"/>
      <ellipse cx="200" cy="85" rx="25" ry="12" fill="#ffffff" stroke="${stroke}" stroke-width="2"/>
      <text x="180" y="88" fill="${textColor}" font-size="10" font-weight="700">Ø${d}</text>
      <text x="80" y="140" fill="${textColor}" font-size="11" font-weight="700">${A}x${B} H=${H}</text>
    `;
  } else if (type === 'Spiro') {
    const D = p.dim_D || 200;
    const L = p.dim_L_ml || 6;
    content += `
      <ellipse cx="90" cy="115" rx="30" ry="60" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <line x1="90" y1="55" x2="330" y2="55" stroke="${stroke}" stroke-width="2"/>
      <line x1="90" y1="175" x2="330" y2="175" stroke="${stroke}" stroke-width="2"/>
      <path d="M 330,55 A 30,60 0 0,1 330,175" fill="none" stroke="${stroke}" stroke-width="2"/>
      <path d="M 330,55 A 30,60 0 0,0 330,175" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <path d="M 150,55 A 25,60 0 0,1 150,175" fill="none" stroke="rgba(37,99,235,0.4)" stroke-width="1.5"/>
      <path d="M 210,55 A 25,60 0 0,1 210,175" fill="none" stroke="rgba(37,99,235,0.4)" stroke-width="1.5"/>
      <path d="M 270,55 A 25,60 0 0,1 270,175" fill="none" stroke="rgba(37,99,235,0.4)" stroke-width="1.5"/>
      <line x1="50" y1="55" x2="50" y2="175" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="5" y="120" fill="${textColor}" font-size="12" font-weight="700">Ø=${D} mm</text>
      <line x1="90" y1="195" x2="330" y2="195" stroke="${dimColor}" stroke-width="1.5" marker-start="url(#arr-rev)" marker-end="url(#arr)"/>
      <text x="185" y="215" fill="${textColor}" font-size="12" font-weight="700">L=${L} ml</text>
    `;
  } else {
    // Other circular items (Cot, Teu, Reductie, Stut, Capac, Niplu, Clapeta)
    const D = p.dim_D || 200;
    content += `
      <rect x="90" y="60" width="220" height="110" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <ellipse cx="90" cy="115" rx="20" ry="55" fill="rgba(37,99,235,0.15)" stroke="${stroke}" stroke-width="2"/>
      <text x="125" y="115" fill="${textColor}" font-size="13" font-weight="700">Circular Spiro Ø=${D} mm (${type})</text>
    `;
  }

  svg.innerHTML = content;
}

// ====================================================================
// ATELIER PRODUCTION BREAKDOWN
// ====================================================================
function updateAtelierTab() {
  let tabla06 = { s: 0, w: 0 };
  let tabla08 = { s: 0, w: 0 };
  let tabla10 = { s: 0, w: 0 };
  let flansa20 = 0;
  let flansa30 = 0;
  let coltari20 = 0;
  let coltari30 = 0;

  state.items.forEach(it => {
    const s = parseFloat(it.suprafata) || 0;
    const g = it.grosime ? it.grosime.toString().trim() : '0.8';
    const c = it.coltari || 0;

    if (g === '0.6') {
      tabla06.s += s;
      tabla06.w += s * 4.71;
    } else if (g === '1.0' || g === '1') {
      tabla10.s += s;
      tabla10.w += s * 7.85;
    } else {
      tabla08.s += s;
      tabla08.w += s * 6.28;
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

  const totS = tabla06.s + tabla08.s + tabla10.s;
  const totW = tabla06.w + tabla08.w + tabla10.w;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  // Set values for tab-materiale table in index.html
  setTxt('mat-tabla-06', `${tabla06.s.toFixed(2)} m² (${tabla06.w.toFixed(1)} kg)`);
  setTxt('mat-tabla-08', `${tabla08.s.toFixed(2)} m² (${tabla08.w.toFixed(1)} kg)`);
  setTxt('mat-tabla-10', `${tabla10.s.toFixed(2)} m² (${tabla10.w.toFixed(1)} kg)`);
  setTxt('mat-flansa-20', `${flansa20.toFixed(1)} ml (~${Math.ceil(flansa20 / 5)} bare x 5m)`);
  setTxt('mat-flansa-30', `${flansa30.toFixed(1)} ml (~${Math.ceil(flansa30 / 5)} bare x 5m)`);
  setTxt('mat-coltari-20', `${coltari20} buc`);
  setTxt('mat-coltari-30', `${coltari30} buc`);
  const garnitura = (flansa20 + flansa30) / 2;
  setTxt('mat-gasket', `${garnitura.toFixed(1)} ml (~${Math.ceil(garnitura / 10)} role x 10m)`);

  // Fallback legacy IDs if present
  setTxt('atelier-tabla-06', `${tabla06.s.toFixed(2)} m² (${tabla06.w.toFixed(1)} kg)`);
  setTxt('atelier-tabla-08', `${tabla08.s.toFixed(2)} m² (${tabla08.w.toFixed(1)} kg)`);
  setTxt('atelier-tabla-10', `${tabla10.s.toFixed(2)} m² (${tabla10.w.toFixed(1)} kg)`);
  setTxt('atelier-tabla-total', `${totS.toFixed(2)} m² / ${totW.toFixed(1)} kg`);
  setTxt('atelier-foi-tabla', `${Math.ceil(totS / 2)} foi (1x2m)`);
  setTxt('atelier-flansa-20', `${flansa20.toFixed(1)} ml (~${Math.ceil(flansa20 / 5)} bare x 5m)`);
  setTxt('atelier-flansa-30', `${flansa30.toFixed(1)} ml (~${Math.ceil(flansa30 / 5)} bare x 5m)`);
  setTxt('atelier-flansa-total', `${(flansa20 + flansa30).toFixed(1)} ml`);
  setTxt('atelier-garnitura', `${garnitura.toFixed(1)} ml (~${Math.ceil(garnitura / 10)} role x 10m)`);
  setTxt('atelier-coltari-20', `${coltari20} bucăți`);
  setTxt('atelier-coltari-30', `${coltari30} bucăți`);
  setTxt('atelier-suruburi', `${Math.round((coltari20 + coltari30) / 2)} seturi`);
  setTxt('atelier-cleme', `${Math.ceil((flansa20 + flansa30) * 1.5)} bucăți`);
  setTxt('atelier-mastic', `${Math.ceil((flansa20 + flansa30) / 15)} tuburi`);
}

// ====================================================================
// MODAL & CRUD
// ====================================================================
function setupModal() {
  const modal = document.getElementById('edit-modal');
  if (!modal) return;

  const btnClose = document.getElementById('modal-close') || document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('modal-cancel') || document.getElementById('btn-cancel-modal');
  const btnSave = document.getElementById('modal-save');
  const editForm = document.getElementById('modal-edit-form');

  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('open'));
  if (btnCancel) btnCancel.addEventListener('click', () => modal.classList.remove('open'));

  const handleSave = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const idx = state.editingIndex;
    if (idx < 0 || idx >= state.items.length) return;

    const elEticheta = document.getElementById('modal-eticheta');
    const elDim = document.getElementById('modal-dimensiuni');
    const elCant = document.getElementById('modal-cantitate');
    const elSup = document.getElementById('modal-suprafata');
    const elPret = document.getElementById('modal-pret');

    if (elEticheta) state.items[idx].eticheta = elEticheta.value;
    if (elDim) state.items[idx].dimensiuni = elDim.value;
    if (elCant) state.items[idx].cantitate = parseFloat(elCant.value) || 1;
    if (elSup) state.items[idx].suprafata = parseFloat(elSup.value) || 0;
    if (elPret) state.items[idx].valoareTotala = parseFloat(elPret.value) || 0;

    modal.classList.remove('open');
    saveCartToStorage();
    applyFiltersAndRender();
    updateKPICards();
    updateAtelierTab();
    showToast('Piesa a fost actualizată!');
  };

  if (btnSave) btnSave.addEventListener('click', handleSave);
  if (editForm) editForm.addEventListener('submit', handleSave);
}

window.openEditModal = function(index) {
  const it = state.items[index];
  if (!it) return;

  state.editingIndex = index;
  document.getElementById('modal-eticheta').value = it.eticheta || '';
  document.getElementById('modal-dimensiuni').value = it.dimensiuni || '';
  document.getElementById('modal-cantitate').value = it.cantitate || 1;
  document.getElementById('modal-suprafata').value = it.suprafata || 0;
  document.getElementById('modal-pret').value = it.valoareTotala || 0;

  document.getElementById('edit-modal').classList.add('open');
};

window.deleteItem = function(index) {
  const numericIdx = parseInt(index, 10);
  if (isNaN(numericIdx) || numericIdx < 0 || numericIdx >= state.items.length) {
    console.warn('Index invalid pentru ștergere:', index);
    return;
  }
  const it = state.items[numericIdx];
  const label = it?.eticheta || `Piesa #${numericIdx + 1}`;

  state.items.splice(numericIdx, 1);
  state.items.forEach((item, i) => item.nr = i + 1);

  // Recalculare pagină activă dacă ultima pagină a rămas goală
  const maxPage = Math.max(1, Math.ceil(state.items.length / state.rowsPerPage));
  if (state.currentPage > maxPage) {
    state.currentPage = maxPage;
  }

  saveCartToStorage();
  applyFiltersAndRender();
  updateKPICards();
  updateAtelierTab();
  showToast(`Piesa "${label}" a fost ștearsă din comandă.`);
};

window.clearCart = function() {
  if (!state.items || state.items.length === 0) {
    showToast('Coșul de comandă este deja gol.');
    return;
  }

  showAppConfirm(
    'Golire Coș de Comandă',
    'Sunteți sigur că doriți să ștergeți toate piesele din coșul curent?',
    () => {
      const count = state.items.length;
      state.items = [];
      state.currentPage = 1;
      localStorage.removeItem('kronvent_client_cart');
      applyFiltersAndRender();
      updateKPICards();
      updateAtelierTab();
      showToast(`Toate cele ${count} piese au fost șterse din comandă. Coșul este gol.`);
    },
    null,
    'Da, Golește Coșul',
    'Renunță',
    true
  );
};

// Salvare stare proiect în stocarea locală
function saveProjectToServer() {
  saveCartToStorage();
  showToast('Specificația tehnică a fost salvată în sesiunea locală!', 'success');
}

// ====================================================================
// IMPORT EXCEL (.XLSX) PENTRU PORTALUL CLIENTULUI
// ====================================================================
function handleClientExcelImport(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    showToast('Biblioteca XLSX nu este încărcată.', 'error');
    return;
  }

  showToast(`Se citește fișierul Excel "${file.name}"...`, 'info');

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('comanda')) || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (!jsonRows || jsonRows.length < 2) {
        showToast('Fișierul Excel nu conține rânduri valide de date.', 'error');
        return;
      }

      // 1. Detectare metadate client/proiect în primele rânduri
      for (let r = 0; r < Math.min(jsonRows.length, 6); r++) {
        const row = jsonRows[r];
        if (!Array.isArray(row)) continue;
        const line = row.map(c => String(c || '').trim()).join(' ');
        const clientMatch = line.match(/Client\s*:\s*([^;,\n]+)/i);
        if (clientMatch && clientMatch[1]) {
          const el = document.getElementById('order-client');
          if (el && !el.value) el.value = clientMatch[1].trim();
        }
        const projMatch = line.match(/(?:Proiect|Subiect|Obiectiv)\s*:\s*([^;,\n]+)/i);
        if (projMatch && projMatch[1]) {
          const el = document.getElementById('order-proiect');
          if (el && !el.value) el.value = projMatch[1].trim();
        }
      }

      // 2. Mapare inteligentă a coloanelor
      let headerRowIdx = -1;
      let colMap = {
        nr: -1,
        eticheta: -1,
        categorie: -1,
        cod: -1,
        dimensiuni: -1,
        cantitate: -1,
        um: -1,
        sUnit: -1,
        suprafata: -1,
        pretUnitar: -1,
        valoareTotala: -1,
        flansa: -1,
        grosime: -1
      };

      for (let r = 0; r < Math.min(jsonRows.length, 12); r++) {
        const row = jsonRows[r];
        if (!Array.isArray(row)) continue;
        const rowStr = row.map(c => String(c || '').toLowerCase().trim());
        
        rowStr.forEach((cell, cIdx) => {
          if (cell === 'nr' || cell === 'nr.' || cell === 'nr crt' || cell === 'crt' || cell === 'poz') colMap.nr = cIdx;
          else if (cell.includes('etichet') || cell.includes('denumire') || cell.includes('reper') || cell.includes('descriere') || cell === 'nume') colMap.eticheta = cIdx;
          else if (cell.includes('categ') || cell.includes('tip piesa') || cell === 'tip') colMap.categorie = cIdx;
          else if (cell === 'cod' || cell.includes('simbol')) colMap.cod = cIdx;
          else if (cell.includes('dimens') || cell.includes('dim') || cell.includes('marime') || cell.includes('gabari')) colMap.dimensiuni = cIdx;
          else if (cell.includes('cant') || cell.includes('buc') || cell === 'qty' || cell === 'bucati') colMap.cantitate = cIdx;
          else if (cell === 'um' || cell === 'u.m.' || cell === 'unitate') colMap.um = cIdx;
          else if (cell.includes('unit') && (cell.includes('sup') || cell.includes('mp') || cell.includes('s.'))) colMap.sUnit = cIdx;
          else if (cell.includes('supraf') || cell.includes('mp') || cell === 's.tot' || cell === 'arie') colMap.suprafata = cIdx;
          else if (cell.includes('pret') || cell.includes('p.u') || cell.includes('tarif')) colMap.pretUnitar = cIdx;
          else if (cell.includes('valoare') || cell.includes('total') || cell === 'val') colMap.valoareTotala = cIdx;
          else if (cell.includes('flans')) colMap.flansa = cIdx;
          else if (cell.includes('grosim')) colMap.grosime = cIdx;
        });

        if (colMap.dimensiuni !== -1 || colMap.eticheta !== -1 || (colMap.cantitate !== -1 && colMap.cod !== -1)) {
          headerRowIdx = r;
          break;
        }
      }

      // Format standard KronVent ca fallback
      if (headerRowIdx === -1 && jsonRows[0] && jsonRows[0].length >= 5) {
        colMap = {
          nr: 0, eticheta: 1, categorie: 2, cod: 3, dimensiuni: 4,
          cantitate: 5, um: 6, sUnit: 7, suprafata: 8, pretUnitar: 9,
          valoareTotala: 10, flansa: 11, grosime: 12
        };
        headerRowIdx = 0;
      }

      const importedItems = [];
      const startR = (headerRowIdx !== -1) ? headerRowIdx + 1 : 1;

      for (let r = startR; r < jsonRows.length; r++) {
        const row = jsonRows[r];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const eticheta = colMap.eticheta !== -1 ? String(row[colMap.eticheta] || '').trim() : '';
        const dimensiuni = colMap.dimensiuni !== -1 ? String(row[colMap.dimensiuni] || '').trim() : '';
        const cant = colMap.cantitate !== -1 ? (parseFloat(row[colMap.cantitate]) || 1) : 1;

        if (!eticheta && !dimensiuni) continue;
        if (eticheta.toLowerCase().includes('total') || eticheta.toLowerCase().includes('subtotal')) continue;

        let cod = colMap.cod !== -1 ? String(row[colMap.cod] || '').trim().toUpperCase() : '';
        let categorie = colMap.categorie !== -1 ? String(row[colMap.categorie] || '').trim() : '';

        // Auto-detectare cod piesă dacă lipsește
        if (!cod) {
          const l = (eticheta + ' ' + categorie).toLowerCase();
          if (l.includes('cot')) cod = 'CR';
          else if (l.includes('reduc') || l.includes('red')) cod = 'RED';
          else if (l.includes('teu')) cod = 'TEU';
          else if (l.includes('capac')) cod = 'Capac';
          else if (l.includes('spiro') || l.includes('circ')) cod = 'SPIRO';
          else cod = 'CRD';
        }

        if (!categorie) {
          if (cod === 'CR') categorie = 'Cot rectangular ( fara dirijori )';
          else if (cod === 'RED') categorie = 'Reductie';
          else if (cod === 'TEU') categorie = 'Teu';
          else if (cod === 'Capac') categorie = 'Capac';
          else if (cod === 'SPIRO') categorie = 'Tubulatura Circulara Spiro';
          else categorie = 'Canal drept';
        }

        const flansa = colMap.flansa !== -1 ? String(row[colMap.flansa] || '').trim() : '';
        const grosime = colMap.grosime !== -1 ? String(row[colMap.grosime] || '').trim().replace(' mm', '') : '';
        let suprafata = colMap.suprafata !== -1 ? parseFloat(row[colMap.suprafata]) : undefined;
        let sUnit = colMap.sUnit !== -1 ? parseFloat(row[colMap.sUnit]) : undefined;
        let pretUnitar = colMap.pretUnitar !== -1 ? parseFloat(row[colMap.pretUnitar]) : undefined;
        let valoareTotala = colMap.valoareTotala !== -1 ? parseFloat(row[colMap.valoareTotala]) : undefined;

        // Calcul suprafață din dimensiuni dacă nu este furnizată
        if ((!suprafata || isNaN(suprafata)) && dimensiuni) {
          const nums = dimensiuni.match(/\d+/g);
          if (nums && nums.length >= 2) {
            const a = parseInt(nums[0], 10) || 500;
            const b = parseInt(nums[1], 10) || 500;
            const l = nums.length >= 3 ? (parseInt(nums[2], 10) || 1250) : 1250;
            sUnit = ((2 * (a / 1000) + 2 * (b / 1000)) * (l / 1000));
            suprafata = sUnit * cant;
          }
        }

        const rawItem = {
          nr: state.items.length + importedItems.length + 1,
          eticheta: eticheta || `Piesa ${state.items.length + importedItems.length + 1}`,
          categorie,
          cod,
          dimensiuni: dimensiuni || 'A=500;B=500;L=1250',
          cantitate: cant,
          um: 'buc',
          sUnit: sUnit || (suprafata && cant > 0 ? suprafata / cant : undefined),
          suprafata: suprafata,
          pretUnitar: pretUnitar,
          valoareTotala: valoareTotala,
          flansa,
          grosime
        };

        importedItems.push(enrichItemData(rawItem, rawItem.nr));
      }

      if (importedItems.length > 0) {
        state.items = [...state.items, ...importedItems];
        saveCartToStorage();
        applyFiltersAndRender();
        updateKPICards();
        updateAtelierTab();
        showToast(`Fișierul Excel "${file.name}" a fost importat cu succes! S-au adăugat ${importedItems.length} poziții în coș.`, 'success');
      } else {
        showToast('Nu s-au putut extrage piese valide din fișierul Excel.', 'warning');
      }
    } catch (err) {
      console.error('Eroare import Excel:', err);
      showToast('Eroare la procesarea fișierului Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}


async function resetProjectData() {
  showAppConfirm(
    'Reinițializare Comandă',
    'Sigur doriți să reîncărcați datele inițiale din fișierul Excel? Modificările curente se vor pierde.',
    async () => {
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          await loadInitialData();
          showToast('Datele au fost resetate la starea inițială din Excel!', 'success');
        }
      } catch (e) {
        showToast('Eroare la reset: ' + e.message, 'error');
      }
    },
    null,
    'Da, Resetează',
    'Renunță',
    true
  );
}

function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Biblioteca Excel nu este încărcată.', 'error');
    return;
  }

  if (!state.items || state.items.length === 0) {
    showToast('Coșul de comandă este gol. Adăugați piese pentru a genera exportul.');
    return;
  }

  const wb = XLSX.utils.book_new();

  const client = document.getElementById('order-client')?.value?.trim() || state.meta.client || 'Client B2B';
  const proiect = document.getElementById('order-proiect')?.value?.trim() || state.meta.subiect || 'Oferta HVAC Proiect';
  const numarCmd = document.getElementById('order-numar')?.value?.trim() || state.meta.numar || `CMD-KV-${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;
  const dataCmd = document.getElementById('order-data')?.value?.trim() || state.meta.data || new Date().toLocaleDateString('ro-RO');
  const tel = document.getElementById('order-contact-tel')?.value?.trim() || state.meta.telefon || '-';
  const email = document.getElementById('order-contact-email')?.value?.trim() || state.meta.email || '-';
  const adresa = document.getElementById('order-adresa')?.value?.trim() || state.meta.adresa || '-';
  const cursBnr = state.settings.cursEur || 5.2542;
  const tvaPercent = parseFloat(document.getElementById('order-tva-select')?.value) || state.settings.tva || 21;

  // Calcule totale generale
  let totalSuprafata = 0;
  let totalBucati = 0;
  let totalEurFaraTva = 0;

  state.items.forEach(it => {
    totalSuprafata += (parseFloat(it.suprafata) || 0);
    totalBucati += (parseInt(it.cantitate, 10) || 0);
    totalEurFaraTva += (parseFloat(it.valoareTotala) || 0);
  });

  const totalRonFaraTva = totalEurFaraTva * cursBnr;
  const valoareTvaEur = (totalEurFaraTva * tvaPercent) / 100;
  const valoareTvaRon = (totalRonFaraTva * tvaPercent) / 100;
  const totalEurCuTva = totalEurFaraTva + valoareTvaEur;
  const totalRonCuTva = totalRonFaraTva + valoareTvaRon;

  // Sheet 1: Comanda și Ofertare HVAC
  const rows = [
    ['KRONVENT BRAȘOV - FABRICĂ TUBULATURĂ HVAC (25.000 m²/lună)'],
    ['NOTĂ DE COMANDĂ & SPECIFICAȚIE TEHNICĂ DE PRODUCȚIE'],
    [],
    ['Număr Comandă:', numarCmd, '', 'Data:', dataCmd],
    ['Beneficiar / Client:', client, '', 'Curs BNR:', `1 EUR = ${cursBnr.toFixed(4)} RON (${state.settings.cursBnrDate || '09.09.2026'})`],
    ['Proiect / Șantier:', proiect, '', 'Telefon Contact:', tel],
    ['Adresă Livrare:', adresa, '', 'Email:', email],
    ['Bază Calcul Rectangular:', `${state.settings.pretMpRectangular} €/mp`, '', 'Regim TVA:', `${tvaPercent}%`],
    [],
    [
      'Nr. Crt.',
      'Etichetă / Descriere Piesă',
      'Categorie / Tip Piesă',
      'Cod Piesă',
      'Dimensiuni Specificate (mm)',
      'U.M.',
      'Cantitate',
      'Suprafață Unitară (m²)',
      'Suprafață Totală (m²)',
      'Preț Unitar (€)',
      'Valoare Totală (€)',
      'Valoare Totală (RON)',
      'Flanșă',
      'Grosime Tablă (mm)'
    ]
  ];

  state.items.forEach((it, idx) => {
    const valEur = parseFloat(it.valoareTotala) || 0;
    const valRon = valEur * cursBnr;
    rows.push([
      idx + 1,
      it.eticheta || '',
      it.categorie || '',
      it.cod || '',
      it.dimensiuni || '',
      it.um || 'buc',
      it.cantitate || 0,
      parseFloat(it.sUnit || 0).toFixed(3),
      parseFloat(it.suprafata || 0).toFixed(3),
      parseFloat(it.pretUnitar || 0).toFixed(2),
      valEur.toFixed(2),
      valRon.toFixed(2),
      it.flansa || '',
      it.grosime || ''
    ]);
  });

  // Linie liberă
  rows.push([]);

  // Linii de totaluri
  rows.push([
    '', 'TOTALURI COMANDĂ (FĂRĂ TVA)', '', '', '', 'buc',
    totalBucati,
    '',
    totalSuprafata.toFixed(3),
    '',
    totalEurFaraTva.toFixed(2),
    totalRonFaraTva.toFixed(2),
    '', ''
  ]);
  rows.push([
    '', `TVA (${tvaPercent}%)`, '', '', '', '', '', '', '', '',
    valoareTvaEur.toFixed(2),
    valoareTvaRon.toFixed(2),
    '', ''
  ]);
  rows.push([
    '', `TOTAL GENERAL CU TVA (${tvaPercent}%)`, '', '', '', '', '', '', '', '',
    totalEurCuTva.toFixed(2),
    totalRonCuTva.toFixed(2),
    '', ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8 },  // Nr Crt
    { wch: 34 }, // Eticheta
    { wch: 24 }, // Categorie
    { wch: 14 }, // Cod
    { wch: 28 }, // Dimensiuni
    { wch: 8 },  // UM
    { wch: 12 }, // Cantitate
    { wch: 22 }, // S Unit
    { wch: 22 }, // S Total
    { wch: 16 }, // Pret Unit
    { wch: 18 }, // Valoare EUR
    { wch: 18 }, // Valoare RON
    { wch: 12 }, // Flansa
    { wch: 18 }  // Grosime
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Comanda_HVAC');

  // Sheet 2: Consumuri Materiale Atelier
  let tabla06S = 0, tabla06W = 0;
  let tabla08S = 0, tabla08W = 0;
  let tabla10S = 0, tabla10W = 0;
  let flansa20Ml = 0, flansa30Ml = 0;
  let coltari20Buc = 0, coltari30Buc = 0;

  state.items.forEach(it => {
    const s = parseFloat(it.suprafata) || 0;
    const g = it.grosime ? it.grosime.toString().trim() : '0.8';
    const c = it.coltari || 0;

    if (g === '0.6') {
      tabla06S += s;
      tabla06W += s * 4.71;
    } else if (g === '1.0' || g === '1') {
      tabla10S += s;
      tabla10W += s * 7.85;
    } else {
      tabla08S += s;
      tabla08W += s * 6.28;
    }

    if (it.dimensiuni && it.categorie !== 'Tubulatura Circulara Spiro') {
      const nums = it.dimensiuni.match(/\d+/g);
      if (nums && nums.length >= 2) {
        const a = parseInt(nums[0], 10) || 0;
        const b = parseInt(nums[1], 10) || 0;
        const cant = it.cantitate || 1;
        const ml = ((a + b) * 4 / 1000) * cant;
        if (it.flansa === 'FLANSA30') {
          flansa30Ml += ml;
          coltari30Buc += c;
        } else {
          flansa20Ml += ml;
          coltari20Buc += c;
        }
      }
    }
  });

  const matRows = [
    ['KRONVENT BRAȘOV - SPECIFICAȚIE CONSUMURI MATERIALE ATELIER'],
    [`Comandă: ${numarCmd} | Client: ${client} | Proiect: ${proiect}`],
    [],
    ['Tip Material / Consumabil', 'Specificație / Calitate', 'Cantitate Calculată', 'U.M.', 'Observații Producție'],
    ['Tablă Zincată DX51D+Z275 (0.6 mm)', 'Grosime 0.6 mm', tabla06S.toFixed(2), 'm²', `${tabla06W.toFixed(1)} kg masă estimată`],
    ['Tablă Zincată DX51D+Z275 (0.8 mm)', 'Grosime 0.8 mm (Standard)', tabla08S.toFixed(2), 'm²', `${tabla08W.toFixed(1)} kg masă estimată`],
    ['Tablă Zincată DX51D+Z275 (1.0 mm)', 'Grosime 1.0 mm (Heavy duty)', tabla10S.toFixed(2), 'm²', `${tabla10W.toFixed(1)} kg masă estimată`],
    ['Total Tablă Zincată', 'Toate grosimile', (tabla06S + tabla08S + tabla10S).toFixed(2), 'm²', `${(tabla06W + tabla08W + tabla10W).toFixed(1)} kg total materie primă`],
    ['Profil Flanșă 20 mm', 'Profil rigidizare canal 20', flansa20Ml.toFixed(1), 'ml', 'Pentru canale standard'],
    ['Profil Flanșă 30 mm', 'Profil rigidizare canal 30', flansa30Ml.toFixed(1), 'ml', 'Pentru secțiuni mari > 800 mm'],
    ['Colțari Flanșă 20 mm', 'Piese îmbinare colț', coltari20Buc, 'buc', 'Zincat 2.0 mm'],
    ['Colțari Flanșă 30 mm', 'Piese îmbinare colț', coltari30Buc, 'buc', 'Zincat 2.5 mm'],
    ['Mastic Etanșare Acrilic HVAC', 'Tuburi 310 ml', Math.ceil(totalSuprafata / 15), 'tuburi', 'Etanșare clasa B conform EN 1507'],
    ['Banda Autoadezivă Aluminiu 50mm', 'Role 50 m', Math.ceil(totalSuprafata / 35), 'role', 'Etanșare exterioară îmbinări']
  ];

  const wsMat = XLSX.utils.aoa_to_sheet(matRows);
  wsMat['!cols'] = [
    { wch: 36 },
    { wch: 28 },
    { wch: 18 },
    { wch: 10 },
    { wch: 36 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMat, 'Consumuri_Atelier');

  const safeProjectName = proiect.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const fileName = `Comanda_KronVent_${numarCmd.replace(/[^a-zA-Z0-9]/g, '_')}_${safeProjectName}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`Fișierul Excel "${fileName}" a fost generat și descărcat cu succes!`);
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
