'use strict';

const LOGO_URL = 'https://i.imgur.com/oyqM5oF.png';
const KEY_LAST = 'bs.last.v2';
const KEY_SET = 'bs.settings.v2';
const KEY_SW = 'bs.sw.v2';
const KEY_OLD = 'bs.projects.v1';
const APPF = 'Cikin app';
const LOOSE = "Fayiloli da aka ɗauko";
const ALLF = '__all';
const VEXT = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', '3gp', 'ogv']);
const IEXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']);
const LANGS = [['auto', 'Gane kai tsaye (auto)'], ['en-US', 'English'], ['ha-NG', 'Hausa'], ['yo-NG', 'Yoruba'], ['fr-FR', 'Français'], ['ar-SA', 'العربية'], ['sw-KE', 'Kiswahili'], ['es-ES', 'Español'], ['pt-PT', 'Português'], ['de-DE', 'Deutsch'], ['hi-IN', 'हिन्दी'], ['zh-CN', '中文'], ['tr-TR', 'Türkçe'], ['ru-RU', 'Русский']];
const FONT = '"Segoe UI",Roboto,Arial,sans-serif';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = t => {
  t = Math.max(0, t || 0);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
};
const fmt1 = t => (t || 0).toFixed(1) + 's';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => {
  let id = 0;
  return (...a) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...a), ms);
  };
};
const mb = n => (n / 1048576 >= 1024 ? (n / 1073741824).toFixed(2) + ' GB' : (n / 1048576).toFixed(1) + ' MB');
const keyOf = f => f.name + '|' + f.size + '|' + f.lastModified;
const extOf = n => (n.split('.').pop() || '').toLowerCase();

let toastTimer = 0;
function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      if (this.db) return res(this.db);
      const r = indexedDB.open('bidiyo-studio', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blobs');
      r.onsuccess = () => {
        this.db = r.result;
        res(r.result);
      };
      r.onerror = () => rej(r.error);
    });
  },
  async _put(k, v) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put(v, k);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  },
  async _get(k) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const r = db.transaction('blobs', 'readonly').objectStore('blobs').get(k);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async _del(k) {
    const db = await this.open();
    return new Promise(res => {
      const t = db.transaction('blobs', 'readwrite');
      t.objectStore('blobs').delete(k);
      t.oncomplete = () => res();
      t.onerror = () => res();
      t.onabort = () => res();
    });
  },
  async put(k, v) {
    if (!k.startsWith('meta:') && v instanceof Blob && v.size > 2097152) {
      const root = await Store.root();
      if (root) {
        try {
          const fh = await root.getFileHandle('b_' + k, { create: true });
          const w = await fh.createWritable();
          await w.write(v);
          await w.close();
          await this._put(k, { __opfs: 1, type: v.type, size: v.size });
          return;
        } catch (e) {}
      }
    }
    await this._put(k, v);
  },
  async get(k) {
    const r = await this._get(k);
    if (r && r.__opfs) {
      try {
        const root = await Store.root();
        const fh = await root.getFileHandle('b_' + k);
        const f = await fh.getFile();
        return f.slice(0, f.size, r.type);
      } catch (e) {
        return undefined;
      }
    }
    return r;
  },
  async del(k) {
    let r = null;
    try {
      r = await this._get(k);
    } catch (e) {}
    if (r && r.__opfs) {
      try {
        const root = await Store.root();
        await root.removeEntry('b_' + k);
      } catch (e) {}
    }
    await this._del(k);
  }
};

const Store = {
  async root() {
    try {
      if (navigator.storage && navigator.storage.getDirectory) return await navigator.storage.getDirectory();
    } catch (e) {}
    return null;
  },
  async openOut(id) {
    const d = await this.root();
    if (!d) return null;
    try {
      const fh = await d.getFileHandle('out_' + id, { create: true });
      const w = await fh.createWritable();
      return { w, fh };
    } catch (e) {
      return null;
    }
  },
  async getOut(id, type) {
    const d = await this.root();
    if (d) {
      try {
        const fh = await d.getFileHandle('out_' + id);
        const f = await fh.getFile();
        return type ? f.slice(0, f.size, type) : f;
      } catch (e) {}
    }
    return await DB.get('out_' + id);
  },
  async delOut(id) {
    const d = await this.root();
    if (d) {
      try {
        await d.removeEntry('out_' + id);
      } catch (e) {}
    }
    await DB.del('out_' + id);
  }
};

const urlCache = new Map();
async function urlFor(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const b = await DB.get(id);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(id, u);
  return u;
}
function freeUrl(id) {
  const u = urlCache.get(id);
  if (u) {
    URL.revokeObjectURL(u);
    urlCache.delete(id);
  }
}

function loadJSON(k, d) {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v == null ? d : v;
  } catch (e) {
    return d;
  }
}
function saveJSON(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch (e) {
    return false;
  }
}

let projects = [];
let media = [];
let settings = Object.assign({ autoCap: true, lang: 'en-US', micGain: 3, nr: 'high', capSrc: 'vo', micId: '', asrModel: 'base', pd: null }, loadJSON(KEY_SET, {}));
let proj = null;
let selIdx = -1;
let selOv = null;

const mediaBy = id => media.find(m => m.id === id);

function normalizeProject(p) {
  p.scenes = Array.isArray(p.scenes) ? p.scenes : [];
  p.musicVol = typeof p.musicVol === 'number' ? p.musicVol : 0.6;
  p.duck = p.duck !== false;
  const lg = p.logo || {};
  p.logo = Object.assign({ on: true, size: 0.13, nx: 0.905, ny: 0.085, anim: true, custom: null, center: false, opacity: 0.15 }, lg);
  p.aspect = p.aspect || '9:16';
  p.res = p.res || 720;
  p.fitMode = p.fitMode === 'fill' ? 'fill' : 'fit';
  p.capAnim = p.capAnim || 'pop';
  p.aud = Object.assign({ voVol: 1, origVol: 1, autoMute: true }, p.aud || {});
  p.ui = p.ui || { t: 0, sel: 0 };
  p.music = p.music || null;
  p.scenes.forEach(s => {
    s.speed = s.speed || 1;
    s.origVol = typeof s.origVol === 'number' ? s.origVol : 1;
    s.voVol = typeof s.voVol === 'number' ? s.voVol : 1;
    s.voRate = s.voRate || 1;
    s.text = s.text || '';
    s.voDur = s.voDur || 0;
    s.trimIn = s.trimIn || 0;
    s.trans = s.trans || 'none';
    s.motion = !!s.motion;
    s.overlays = Array.isArray(s.overlays) ? s.overlays : [];
    s.caps = Array.isArray(s.caps) ? s.caps : null;
    if (s.type === 'video') s.trimOut = s.trimOut || s.srcDur || 1;
  });
  return p;
}

function setSaved(wait) {
  const el = $('#saveState');
  el.classList.toggle('wait', !!wait);
  el.innerHTML = wait ? '<i class="fa-solid fa-spinner fa-spin"></i>' : '<i class="fa-solid fa-circle-check"></i>';
}
async function saveProjects() {
  try {
    await DB.put('meta:projects', projects);
    return true;
  } catch (e) {
    toast('Ajiya ta cika, goge wasu abubuwa');
    return false;
  }
}
async function saveMedia() {
  try {
    await DB.put('meta:media', media);
  } catch (e) {}
}
function persist() {
  if (!proj) return Promise.resolve();
  proj.updated = Date.now();
  proj.ui = { t: P.t, sel: selIdx };
  const i = projects.findIndex(p => p.id === proj.id);
  if (i < 0) projects.unshift(proj);
  else projects[i] = proj;
  return saveProjects().then(() => setSaved(false));
}
const persistSoon = debounce(persist, 500);
const rememberDefaults = debounce(() => {
  if (!proj) return;
  settings.pd = {
    aud: proj.aud, capAnim: proj.capAnim, fitMode: proj.fitMode, aspect: proj.aspect, res: proj.res, duck: proj.duck, musicVol: proj.musicVol,
    logo: { on: proj.logo.on, size: proj.logo.size, anim: proj.logo.anim, nx: proj.logo.nx, ny: proj.logo.ny, center: proj.logo.center, opacity: proj.logo.opacity, custom: null }
  };
  saveJSON(KEY_SET, settings);
}, 800);
function touch() {
  if (!proj) return;
  proj.dirty = true;
  setSaved(true);
  persistSoon();
  rememberDefaults();
}

const clipDur = s => (s.type === 'image' ? s.dur : Math.max(0.1, (s.trimOut - s.trimIn) / s.speed));
const voEff = s => (s.voId ? s.voDur / (s.voRate || 1) : 0);
const sceneDur = s => Math.max(clipDur(s), s.voId ? voEff(s) + 0.1 : 0);
const hasCaps = () => !!proj && proj.scenes.some(s => (s.text || '').trim());
const curScene = () => (proj && proj.scenes[selIdx]) || null;
const srcTime = (s, local) => clamp(s.trimIn + Math.min(local, clipDur(s)) * s.speed, 0, Math.max(0, s.trimOut - 0.04));

function dims(aspect, res) {
  const even = n => Math.round(n / 2) * 2;
  if (aspect === '16:9') return { w: even(res * 16 / 9), h: even(res) };
  if (aspect === '1:1') return { w: even(res), h: even(res) };
  return { w: even(res), h: even(res * 16 / 9) };
}

function waitMeta(el) {
  return new Promise(res => {
    if (el.readyState >= 1) return res();
    let done = false;
    const f = () => {
      if (done) return;
      done = true;
      el.removeEventListener('loadedmetadata', f);
      el.removeEventListener('error', f);
      clearTimeout(tm);
      res();
    };
    const tm = setTimeout(f, 8000);
    el.addEventListener('loadedmetadata', f);
    el.addEventListener('error', f);
  });
}
function seekEl(el, t) {
  return new Promise(res => {
    if (!isFinite(t)) return res();
    if (Math.abs(el.currentTime - t) < 0.03 && el.readyState >= 2) return res();
    let done = false;
    const f = () => {
      if (done) return;
      done = true;
      el.removeEventListener('seeked', f);
      clearTimeout(tm);
      res();
    };
    const tm = setTimeout(f, 2500);
    el.addEventListener('seeked', f);
    try {
      el.currentTime = t;
    } catch (e) {
      f();
    }
  });
}

function snap(el, w, h) {
  try {
    const tw = 120;
    const th = Math.max(1, Math.round(tw * (h || 1) / (w || 1)));
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    c.getContext('2d').drawImage(el, 0, 0, tw, th);
    return c.toDataURL('image/jpeg', 0.55);
  } catch (e) {
    return '';
  }
}
function probeVideo(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    let finished = false;
    const fail = { dur: 0, thumb: '', w: 0, h: 0 };
    const finish = out => {
      if (finished) return;
      finished = true;
      clearTimeout(tm);
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      v.load();
      resolve(out);
    };
    const tm = setTimeout(() => finish(fail), 12000);
    v.onerror = () => finish(fail);
    v.onloadedmetadata = () => {
      const d = v.duration;
      if (!isFinite(d) || d <= 0) return finish(fail);
      v.currentTime = Math.max(0.01, Math.min(0.3, d / 2));
    };
    v.onseeked = () => finish({ dur: v.duration, thumb: snap(v, v.videoWidth, v.videoHeight), w: v.videoWidth, h: v.videoHeight });
    v.src = url;
  });
}
function probeImage(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const out = { dur: 0, thumb: snap(im, im.naturalWidth, im.naturalHeight), w: im.naturalWidth, h: im.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    im.src = url;
  });
}
function mediaDuration(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    a.preload = 'metadata';
    const fin = d => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    const tm = setTimeout(() => fin(0), 6000);
    a.onloadedmetadata = () => {
      clearTimeout(tm);
      fin(isFinite(a.duration) ? a.duration : 0);
    };
    a.onerror = () => {
      clearTimeout(tm);
      fin(0);
    };
    a.src = url;
  });
}

async function ingest(file, pre) {
  const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : extOf(file.name) && VEXT.has(extOf(file.name)) ? 'video' : IEXT.has(extOf(file.name)) ? 'image' : null;
  if (!type) throw new Error('type');
  const key = keyOf(file);
  let m = media.find(x => x.key === key);
  if (m) {
    const have = await DB.get(m.id);
    if (have) return m;
    await DB.put(m.id, file);
    return m;
  }
  const meta = pre || (type === 'video' ? await probeVideo(file) : await probeImage(file));
  if (!meta || (type === 'video' && !meta.dur)) throw new Error('bad');
  const id = uid();
  await DB.put(id, file);
  m = { id, key, name: file.name, type, size: file.size, dur: meta.dur || 0, w: meta.w, h: meta.h, thumb: meta.thumb, added: Date.now() };
  media.push(m);
  await saveMedia();
  return m;
}

function makeScene(m) {
  return {
    id: uid(), type: m.type, mediaId: m.id, key: m.key, name: m.name, srcDur: m.dur, dur: 5, trimIn: 0, trimOut: m.dur,
    speed: 1, origVol: 1, muteOrig: false, voId: null, voDur: 0, voVol: 1, voRate: 1, text: '', thumb: m.thumb,
    w: m.w, h: m.h, trans: 'fade', motion: false, overlays: []
  };
}

const appLogo = new Image();
const custLogo = new Image();
let custLogoOk = false;
const logoImgCur = () => (custLogoOk && custLogo.complete && custLogo.naturalWidth ? custLogo : appLogo);
async function loadLogo() {
  let url = LOGO_URL;
  try {
    const r = await fetch(LOGO_URL, { mode: 'cors' });
    if (!r.ok) throw new Error('x');
    const b = await r.blob();
    await DB.put('app-logo', b);
    url = URL.createObjectURL(b);
  } catch (e) {
    try {
      const b = await DB.get('app-logo');
      url = b ? URL.createObjectURL(b) : '';
    } catch (e2) {
      url = '';
    }
  }
  if (url) {
    appLogo.onload = () => {
      if (typeof P !== 'undefined') P.render();
    };
    appLogo.src = url;
    $$('.logo-img').forEach(i => (i.src = url));
  }
}
async function loadCustomLogo() {
  custLogoOk = false;
  if (!proj || !proj.logo.custom) return;
  const u = await urlFor(proj.logo.custom);
  if (!u) return;
  custLogo.onload = () => {
    custLogoOk = true;
    P.render();
  };
  custLogo.src = u;
}

const vEl = document.createElement('video');
vEl.playsInline = true;
vEl.preload = 'auto';
vEl.setAttribute('playsinline', '');
const imEl = new Image();
const voEl = new Audio();
voEl.preload = 'auto';
const muEl = new Audio();
muEl.preload = 'auto';
muEl.loop = true;
$('.hid').appendChild(vEl);
const ovImgs = new Map();
const ovVids = new Map();

const A = {
  ctx: null,
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    const c = new C();
    this.ctx = c;
    this.gV = c.createGain();
    this.gVo = c.createGain();
    this.gM = c.createGain();
    c.createMediaElementSource(vEl).connect(this.gV);
    c.createMediaElementSource(voEl).connect(this.gVo);
    c.createMediaElementSource(muEl).connect(this.gM);
    this.voiceBus = c.createGain();
    this.gV.connect(this.voiceBus);
    this.gVo.connect(this.voiceBus);
    this.an = c.createAnalyser();
    this.an.fftSize = 1024;
    this.voiceBus.connect(this.an);
    this.buf = new Float32Array(this.an.fftSize);
    this.bus = c.createGain();
    this.voiceBus.connect(this.bus);
    this.gM.connect(this.bus);
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -8;
    this.comp.knee.value = 6;
    this.comp.ratio.value = 12;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.25;
    this.bus.connect(this.comp);
    this.mon = c.createGain();
    this.comp.connect(this.mon);
    this.mon.connect(c.destination);
    this.rec = c.createMediaStreamDestination();
    this.comp.connect(this.rec);
  },
  async resume() {
    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch (e) {}
    }
  },
  level() {
    this.an.getFloatTimeDomainData(this.buf);
    let q = 0;
    for (let i = 0; i < this.buf.length; i++) q += this.buf[i] * this.buf[i];
    return Math.sqrt(q / this.buf.length);
  }
};

function splitCaption(text, max) {
  const words = (text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}
const capMax = (W, H) => Math.max(14, Math.floor(32 * W / H));
const timedCache = new WeakMap();
function timedChunks(s, max) {
  const hit = timedCache.get(s);
  if (hit && hit.max === max && hit.src === s.caps && hit.text === s.text) return hit.list;
  const list = [];
  s.caps.forEach(seg => {
    const parts = splitCaption(seg.text, max);
    const wts = parts.map(x => x.length + 2);
    const sum = wts.reduce((a, b) => a + b, 0) || 1;
    const span = Math.max(0.3, seg.b - seg.a);
    let t = seg.a;
    parts.forEach((x, i) => {
      const d = span * wts[i] / sum;
      list.push({ a: t, b: t + d, text: x });
      t += d;
    });
  });
  timedCache.set(s, { max, src: s.caps, text: s.text, list });
  return list;
}
function captionAt(s, local, max) {
  const timed = !!(s.caps && s.caps.length && s.capsFor === s.text);
  let list;
  if (timed) list = timedChunks(s, max);
  else {
    const chunks = splitCaption(s.text, max);
    if (!chunks.length) return null;
    const win = Math.max(0.5, s.voId ? voEff(s) : sceneDur(s));
    const weights = chunks.map(c => c.length + 4);
    const sum = weights.reduce((a, b) => a + b, 0);
    list = [];
    let t = 0;
    chunks.forEach((c, i) => {
      const d = win * weights[i] / sum;
      list.push({ a: t, b: t + d, text: c });
      t += d;
    });
  }
  if (!list.length) return null;
  let i = -1;
  for (let k = 0; k < list.length; k++) {
    if (local >= list[k].a - 1e-6) i = k;
    else break;
  }
  if (i < 0) return null;
  const c = list[i];
  return { text: c.text, p: clamp((local - c.a) / Math.max(0.2, c.b - c.a), 0, 1), age: Math.max(0, local - c.a), prev: i > 0 ? list[i - 1].text : '' };
}

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function mediaRect(sw, sh, x, y, w, h, mode) {
  const r = mode === 'fill' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  const dw = sw * r;
  const dh = sh * r;
  return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh };
}

const frC = document.createElement('canvas');
let frAt = 0;
let frKey = '';
function mediaSource(s, live) {
  if (!s) return null;
  if (s.type === 'video') {
    if (vEl.readyState >= 2 && vEl.videoWidth) {
      const now = performance.now();
      if (live && (now - frAt > 350 || frKey !== s.id)) {
        frAt = now;
        frKey = s.id;
        const w = 480;
        const h = Math.max(2, Math.round(w * vEl.videoHeight / vEl.videoWidth));
        if (frC.width !== w || frC.height !== h) {
          frC.width = w;
          frC.height = h;
        }
        try {
          frC.getContext('2d').drawImage(vEl, 0, 0, w, h);
        } catch (e) {}
      }
      return { el: vEl, w: vEl.videoWidth, h: vEl.videoHeight };
    }
    if (frKey === s.id && frC.width > 2) return { el: frC, w: frC.width, h: frC.height };
    return null;
  }
  if (imEl.complete && imEl.naturalWidth) return { el: imEl, w: imEl.naturalWidth, h: imEl.naturalHeight };
  return null;
}
const ease = p => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
function sceneFx(s, local) {
  let a = 1;
  let sc = 1;
  let dx = 0;
  let dy = 0;
  const T = 0.5;
  if (local < T && s.trans && s.trans !== 'none') {
    const p = ease(local / T);
    if (s.trans === 'fade') a = p;
    else if (s.trans === 'zoom') {
      a = p;
      sc = 1.18 - 0.18 * p;
    } else if (s.trans === 'slide') {
      a = 0.3 + 0.7 * p;
      dx = (1 - p) * 0.25;
    } else if (s.trans === 'slideup') {
      a = 0.3 + 0.7 * p;
      dy = (1 - p) * 0.2;
    }
  }
  if (s.type === 'image' && s.motion) sc *= 1 + 0.12 * Math.min(1, local / Math.max(0.5, sceneDur(s)));
  return { a, sc, dx, dy };
}

function ovRect(ov, W, H) {
  const w = ov.w * W;
  const h = w * (ov.ar || 1);
  return { x: ov.x * W - w / 2, y: ov.y * H - h / 2, w, h };
}
function logoRect(W, H) {
  const sz = proj.logo.size * W;
  return { x: proj.logo.nx * W - sz / 2, y: proj.logo.ny * H - sz / 2, w: sz, h: sz };
}
function ovSource(ov) {
  if (ov.type === 'image') {
    const im = ovImgs.get(ov.mediaId);
    return im && im.complete && im.naturalWidth ? { el: im, w: im.naturalWidth, h: im.naturalHeight } : null;
  }
  const v = ovVids.get(ov.id);
  return v && v.readyState >= 2 && v.videoWidth ? { el: v, w: v.videoWidth, h: v.videoHeight } : null;
}

const tmpLogo = document.createElement('canvas');
function drawCornerLogo(g, W, H, t, ui) {
  const L = proj.logo;
  const img = logoImgCur();
  if (!L.on || !img.complete || !img.naturalWidth) return;
  const sz = Math.max(8, Math.round(L.size * W));
  const lw = img.naturalWidth;
  const lh = img.naturalHeight;
  const r = Math.min(sz / lw, sz / lh);
  let cx = L.nx * W;
  let cy = L.ny * H;
  let k = 1;
  let src = img;
  let dw = lw * r;
  let dh = lh * r;
  if (L.anim) {
    if (tmpLogo.width !== sz || tmpLogo.height !== sz) {
      tmpLogo.width = sz;
      tmpLogo.height = sz;
    }
    const tg = tmpLogo.getContext('2d');
    tg.clearRect(0, 0, sz, sz);
    tg.globalCompositeOperation = 'source-over';
    tg.drawImage(img, (sz - dw) / 2, (sz - dh) / 2, dw, dh);
    const pos = ((t * 0.45) % 2.4 - 0.7) * sz;
    const gr = tg.createLinearGradient(pos - sz * 0.25, 0, pos + sz * 0.25, sz * 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    tg.globalCompositeOperation = 'source-atop';
    tg.fillStyle = gr;
    tg.fillRect(0, 0, sz, sz);
    tg.globalCompositeOperation = 'source-over';
    k = 1 + 0.05 * Math.sin(t * 2.6);
    cy += Math.sin(t * 1.8) * sz * 0.04;
    src = tmpLogo;
    dw = sz;
    dh = sz;
  }
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  g.globalAlpha = 0.92;
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = sz * 0.12;
  g.drawImage(src, -dw / 2, -dh / 2, dw, dh);
  g.restore();
  if (ui && drag && drag.kind === 'logo') {
    g.save();
    g.strokeStyle = '#00d1b2';
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.strokeRect(cx - sz / 2, cy - sz / 2, sz, sz);
    g.restore();
  }
}

const backOut = t => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
function drawCaption(g, W, H, capH, s, local, anim) {
  if (!capH) return;
  const y = H - capH;
  const bg = g.createLinearGradient(0, y, 0, H);
  bg.addColorStop(0, '#141b33');
  bg.addColorStop(1, '#0a0e1c');
  g.fillStyle = bg;
  g.fillRect(0, y, W, capH);
  const lg = g.createLinearGradient(0, 0, W, 0);
  lg.addColorStop(0, '#7c5cff');
  lg.addColorStop(1, '#00d1b2');
  g.fillStyle = lg;
  g.fillRect(0, y, W, Math.max(2, Math.round(H * 0.004)));
  if (!s || !(s.text || '').trim()) return;
  const cap = captionAt(s, local, capMax(W, H));
  if (!cap) return;
  const font = f => '800 ' + f + 'px ' + FONT;
  let fs = capH * 0.42;
  g.font = font(fs);
  while (g.measureText(cap.text).width > W * 0.94 && fs > capH * 0.22) {
    fs -= 1;
    g.font = font(fs);
  }
  const paint = (text, alpha, dy, sc, p, reveal) => {
    g.save();
    g.font = font(fs);
    const total = g.measureText(text).width;
    g.translate(W / 2, y + capH / 2 + capH * 0.04 + dy);
    g.scale(sc, sc);
    g.globalAlpha = clamp(alpha, 0, 1);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const shown = reveal < 1 ? text.slice(0, Math.ceil(text.length * reveal)) : text;
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = fs * 0.15;
    g.fillStyle = '#ffffff';
    g.fillText(shown, -total / 2, 0);
    g.shadowBlur = 0;
    const words = text.split(' ');
    const n = clamp(Math.floor(p * words.length) + 1, 1, words.length);
    const dw = g.measureText(words.slice(0, n).join(' ')).width;
    g.beginPath();
    g.rect(-total / 2 - 4, -capH, dw + 4, capH * 2);
    g.clip();
    g.fillStyle = '#ffd54a';
    g.fillText(shown, -total / 2, 0);
    g.restore();
  };
  const T = 0.28;
  const k = clamp(cap.age / T, 0, 1);
  if (anim !== 'none' && cap.prev && cap.age < 0.18) {
    const q = cap.age / 0.18;
    paint(cap.prev, 1 - q, -q * capH * 0.3, 1, 1, 1);
  }
  if (anim === 'none') paint(cap.text, 1, 0, 1, cap.p, 1);
  else if (anim === 'slide') paint(cap.text, ease(k), (1 - ease(k)) * capH * 0.55, 1, cap.p, 1);
  else if (anim === 'fade') paint(cap.text, ease(k), 0, 1, cap.p, 1);
  else if (anim === 'type') paint(cap.text, 1, 0, 1, cap.p, clamp(cap.age / 0.5, 0, 1));
  else paint(cap.text, Math.min(1, cap.age / 0.1), 0, 0.7 + 0.3 * backOut(k), cap.p, 1);
}

function drawFrame(g, W, H, t, ui) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const capH = hasCaps() ? Math.round(H * 0.13) : 0;
  const vh = H - capH;
  const loc = P.locate(t);
  const s = proj.scenes[loc.i];
  const mode = proj.fitMode === 'fill' ? 'fill' : 'fit';
  const src = mediaSource(s, true);
  if (src) {
    const rect = mediaRect(src.w, src.h, 0, 0, W, vh, mode);
    const fx = sceneFx(s, loc.local);
    g.save();
    g.beginPath();
    g.rect(0, 0, W, vh);
    g.clip();
    g.globalAlpha = fx.a;
    g.translate(W / 2 + fx.dx * W, vh / 2 + fx.dy * vh);
    g.scale(fx.sc, fx.sc);
    g.translate(-W / 2, -vh / 2);
    g.drawImage(src.el, rect.x, rect.y, rect.w, rect.h);
    g.restore();
  }
  if (s) {
    s.overlays.forEach(ov => {
      const o = ovSource(ov);
      if (!o) return;
      const r = ovRect(ov, W, H);
      g.save();
      g.globalAlpha = ov.op;
      g.drawImage(o.el, r.x, r.y, r.w, r.h);
      g.restore();
      if (ui && !P.playing && ov.id === selOv) {
        g.save();
        g.strokeStyle = '#00d1b2';
        g.lineWidth = 2;
        g.setLineDash([6, 4]);
        g.strokeRect(r.x, r.y, r.w, r.h);
        g.restore();
      }
    });
  }
  const cimg = logoImgCur();
  if (proj.logo.center && cimg.complete && cimg.naturalWidth) {
    const lw = W * 0.5;
    const lh = lw * cimg.naturalHeight / cimg.naturalWidth;
    g.save();
    g.globalAlpha = proj.logo.opacity;
    g.drawImage(cimg, (W - lw) / 2, (vh - lh) / 2, lw, lh);
    g.restore();
  }
  drawCornerLogo(g, W, H, t, ui);
  drawCaption(g, W, H, capH, s, loc.local, proj.capAnim);
}

const P = {
  t: 0,
  total: 0,
  lay: [],
  idx: -1,
  playing: false,
  loading: false,
  token: 0,
  vidId: null,
  imgId: null,
  voId: null,
  musId: null,
  last: 0,
  raf: 0,
  exporting: null,
  recMode: false,
  stt: null,
  stopAt: null,
  lastSpeak: 0,
  onEnd: null,
  scrubbing: false,
  waitMs: 0,
  kicked: false,
  reset() {
    this.pause();
    this.token++;
    this.idx = -1;
    this.vidId = null;
    this.imgId = null;
    this.voId = null;
    this.musId = null;
    this.loading = false;
    vEl.removeAttribute('src');
    voEl.removeAttribute('src');
    muEl.removeAttribute('src');
    ovVids.forEach(v => {
      v.pause();
      v.remove();
    });
    ovVids.clear();
    this.t = 0;
  },
  refresh() {
    this.lay = [];
    let a = 0;
    if (proj) {
      proj.scenes.forEach(s => {
        const d = sceneDur(s);
        this.lay.push({ start: a, dur: d });
        a += d;
      });
    }
    this.total = a;
    if (this.t > this.total) this.t = this.total;
  },
  locate(t) {
    for (let i = this.lay.length - 1; i >= 0; i--) {
      if (t >= this.lay[i].start - 1e-6) return { i, local: t - this.lay[i].start };
    }
    return { i: 0, local: 0 };
  },
  applyGains(s) {
    if (!A.ctx) return;
    s = s || (proj && proj.scenes[this.idx]);
    const now = A.ctx.currentTime;
    let go = 0;
    let gv = 0;
    if (s && !this.recMode) {
      if (this.stt) {
        go = this.stt === 'orig' ? 1 : 0;
        gv = this.stt === 'vo' ? 1 : 0;
      } else {
        const a = proj.aud;
        go = s.voId && a.autoMute ? 0 : a.origVol;
        gv = a.voVol;
      }
    }
    A.gV.gain.setTargetAtTime(go, now, 0.01);
    A.gVo.gain.setTargetAtTime(gv, now, 0.01);
    if (!this.exporting) A.mon.gain.setTargetAtTime(this.stt ? 0 : 1, now, 0.01);
  },
  async prepMusic(t) {
    if (proj && proj.music) {
      const url = await urlFor(proj.music.id);
      if (!url) return;
      if (this.musId !== proj.music.id) {
        this.musId = proj.music.id;
        muEl.src = url;
        await waitMeta(muEl);
      }
      const d = muEl.duration;
      if (isFinite(d) && d > 0) {
        try {
          muEl.currentTime = t % d;
        } catch (e) {}
      }
    } else {
      muEl.pause();
      if (this.musId) {
        this.musId = null;
        muEl.removeAttribute('src');
      }
    }
  },
  async enter(i, local, autoplay) {
    const token = ++this.token;
    this.loading = true;
    this.idx = i;
    this.waitMs = 0;
    const s = proj && proj.scenes[i];
    if (!s) {
      this.loading = false;
      return;
    }
    const url = await urlFor(s.mediaId);
    if (token !== this.token) return;
    this.applyGains(s);
    if (url) {
      if (s.type === 'video') {
        if (this.vidId !== s.mediaId) {
          this.vidId = s.mediaId;
          vEl.src = url;
          await waitMeta(vEl);
          if (token !== this.token) return;
        }
        vEl.playbackRate = s.speed;
        await seekEl(vEl, srcTime(s, local));
        if (token !== this.token) return;
      } else if (this.imgId !== s.mediaId) {
        this.imgId = s.mediaId;
        imEl.src = url;
        try {
          await imEl.decode();
        } catch (e) {}
        if (token !== this.token) return;
      }
    }
    if (s.voId) {
      const vu = await urlFor(s.voId);
      if (token !== this.token) return;
      if (vu) {
        if (this.voId !== s.voId) {
          this.voId = s.voId;
          voEl.src = vu;
          await waitMeta(voEl);
          if (token !== this.token) return;
        }
        voEl.playbackRate = s.voRate || 1;
        await seekEl(voEl, Math.min(local * (s.voRate || 1), Math.max(0, s.voDur - 0.05)));
        if (token !== this.token) return;
      }
    } else {
      voEl.pause();
      if (this.voId) {
        this.voId = null;
        voEl.removeAttribute('src');
      }
    }
    await ensureOverlays(s);
    if (token !== this.token) return;
    ovVids.forEach(v => {
      const d = v.duration;
      if (isFinite(d) && d > 0) {
        try {
          v.currentTime = local % d;
        } catch (e) {}
      }
    });
    this.loading = false;
    this.render();
    if (autoplay && this.playing) this.startMedia(s, local);
  },
  startMedia(s, local) {
    if (s.type === 'video' && local < clipDur(s) - 0.05) {
      vEl.playbackRate = s.speed;
      vEl.play().catch(() => {});
    }
    if (s.voId && local * (s.voRate || 1) < s.voDur) {
      voEl.playbackRate = s.voRate || 1;
      voEl.play().catch(() => {});
    }
    if (proj.music) muEl.play().catch(() => {});
    ovVids.forEach(v => v.play().catch(() => {}));
  },
  async play(cb) {
    if (!proj || !proj.scenes.length) return;
    A.init();
    await A.resume();
    if (this.t >= this.total - 0.02 && this.stopAt == null) this.t = 0;
    this.playing = true;
    this.ui();
    const { i, local } = this.locate(this.t);
    await this.prepMusic(this.t);
    await this.enter(i, local, false);
    if (!this.playing) return;
    if (cb) cb();
    this.startMedia(proj.scenes[i], local);
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.raf = requestAnimationFrame(n => this.tick(n));
  },
  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    vEl.pause();
    voEl.pause();
    muEl.pause();
    ovVids.forEach(v => v.pause());
    this.ui();
  },
  end() {
    this.pause();
    this.render();
    if (this.onEnd) {
      const f = this.onEnd;
      this.onEnd = null;
      f();
    }
  },
  async seek(t) {
    if (!proj) return;
    if (this.playing) this.pause();
    this.t = clamp(t, 0, this.total);
    if (!proj.scenes.length) {
      this.ui();
      this.render();
      return;
    }
    const { i, local } = this.locate(this.t);
    await this.enter(i, local, false);
    await this.prepMusic(this.t);
    this.ui();
    this.render();
  },
  tick(now) {
    if (!this.playing) return;
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    if (!this.loading) {
      let hold = false;
      const s0 = proj.scenes[this.idx];
      const L0 = this.lay[this.idx];
      if (s0 && L0 && s0.type === 'video') {
        const local0 = this.t - L0.start;
        if (local0 < clipDur(s0) - 0.1 && (vEl.seeking || vEl.readyState < 2)) {
          this.waitMs += dt * 1000;
          hold = this.waitMs < 6000;
          if (this.waitMs > 1500 && !this.kicked) {
            this.kicked = true;
            try {
              vEl.currentTime = srcTime(s0, Math.max(0, local0));
            } catch (e) {}
            vEl.play().catch(() => {});
          }
        } else {
          this.waitMs = 0;
          this.kicked = false;
        }
      }
      if (!hold) {
        this.t += dt;
        if (this.stopAt != null && this.t >= this.stopAt) {
          this.t = this.stopAt;
          this.pause();
          this.render();
          return;
        }
        if (this.t >= this.total) {
          this.t = this.total;
          this.end();
          return;
        }
        const { i, local } = this.locate(this.t);
        if (i !== this.idx) {
          this.t = this.lay[i].start;
          this.enter(i, 0, true);
        } else {
          this.syncScene(proj.scenes[i], local);
        }
      }
    }
    this.duck(now);
    this.render();
    this.ui();
    this.raf = requestAnimationFrame(n => this.tick(n));
  },
  syncScene(s, local) {
    if (s.type === 'video') {
      if (local >= clipDur(s)) {
        if (!vEl.paused) vEl.pause();
      } else {
        if (vEl.paused && !vEl.ended && vEl.readyState > 1) vEl.play().catch(() => {});
        const exp = srcTime(s, local);
        if (Math.abs(vEl.currentTime - exp) > 0.5) vEl.currentTime = exp;
      }
    }
    if (s.voId) {
      const rate = s.voRate || 1;
      if (local * rate >= s.voDur) {
        if (!voEl.paused) voEl.pause();
      } else {
        if (voEl.paused && !voEl.ended) voEl.play().catch(() => {});
        if (Math.abs(voEl.currentTime - local * rate) > 0.45) voEl.currentTime = local * rate;
      }
    }
  },
  duck(now) {
    if (!A.ctx || !proj) return;
    const lvl = A.level();
    if (lvl > 0.012) this.lastSpeak = now;
    const speaking = now - this.lastSpeak < 420;
    const fade = clamp((this.total - this.t) / 1.5, 0, 1);
    const base = this.recMode || this.stt ? 0 : proj.musicVol;
    const target = (speaking && proj.duck ? base * 0.2 : base) * fade;
    A.gM.gain.setTargetAtTime(target, A.ctx.currentTime, speaking ? 0.08 : 0.4);
  },
  render() {
    if (!proj) return;
    const cv = $('#cv');
    const d = dims(proj.aspect, 480);
    if (cv.width !== d.w || cv.height !== d.h) {
      cv.width = d.w;
      cv.height = d.h;
    }
    drawFrame(cv.getContext('2d'), d.w, d.h, this.t, true);
    if (this.exporting) drawFrame(this.exporting.g, this.exporting.w, this.exporting.h, this.t, false);
  },
  ui() {
    $('#btnPlay').innerHTML = this.playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    $('#tNow').textContent = fmt(this.t);
    $('#tTotal').textContent = fmt(this.total);
    if (!this.scrubbing) $('#scrub').value = this.total ? Math.round(this.t / this.total * 1000) : 0;
    movePlayhead();
  }
};

async function ensureOverlays(s) {
  if (!s) return;
  const keep = new Set(s.overlays.map(o => o.id));
  ovVids.forEach((v, k) => {
    if (!keep.has(k)) {
      v.pause();
      v.removeAttribute('src');
      v.remove();
      ovVids.delete(k);
    }
  });
  for (const o of s.overlays) {
    const url = await urlFor(o.mediaId);
    if (!url) continue;
    if (o.type === 'image') {
      if (!ovImgs.has(o.mediaId)) {
        const im = new Image();
        im.src = url;
        ovImgs.set(o.mediaId, im);
        try {
          await im.decode();
        } catch (e) {}
      }
    } else if (!ovVids.has(o.id)) {
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.preload = 'auto';
      v.src = url;
      $('.hid').appendChild(v);
      ovVids.set(o.id, v);
      await waitMeta(v);
      try {
        await seekEl(v, 0.01);
      } catch (e) {}
    }
  }
}

function sceneW(s) {
  return clamp(Math.round(sceneDur(s) * 22), 76, 240);
}
function phX(t) {
  let x = 0;
  const n = proj.scenes.length;
  for (let i = 0; i < n; i++) {
    const L = P.lay[i];
    const w = sceneW(proj.scenes[i]);
    if (!L) break;
    if (t < L.start + L.dur || i === n - 1) return x + clamp((t - L.start) / L.dur, 0, 1) * w;
    x += w;
  }
  return 0;
}
function movePlayhead() {
  const ph = $('#ph');
  if (!ph || !proj) return;
  const x = phX(P.t) + (proj.scenes.length ? 52 : 0);
  ph.style.transform = 'translateX(' + x + 'px)';
  if (P.playing) {
    const tl = $('#tl');
    const px = x + 12;
    if (px > tl.scrollLeft + tl.clientWidth - 40 || px < tl.scrollLeft) tl.scrollLeft = Math.max(0, px - 60);
  }
}

function renderTimeline() {
  const el = $('#tlInner');
  if (!proj) return;
  const sc = proj.scenes;
  let totalW = 0;
  let v = '<div class="lane v">';
  if (sc.length) v += '<button class="addcard first" id="tlAddStart" aria-label="Ƙara a farko"><i class="fa-solid fa-plus"></i></button>';
  sc.forEach((s, i) => {
    const w = sceneW(s);
    totalW += w;
    v += '<div class="card' + (i === selIdx ? ' sel' : '') + '" data-i="' + i + '" style="width:' + w + 'px">' +
      (s.thumb ? '<img src="' + s.thumb + '" alt="">' : '') +
      '<span class="num">' + (i + 1) + '</span>' +
      '<span class="du">' + fmt1(sceneDur(s)) + '</span>' +
      '<span class="ic">' + (s.type === 'image' ? '<i class="fa-solid fa-image"></i>' : '') +
      (s.overlays.length ? '<i class="fa-solid fa-layer-group"></i>' : '') +
      ((s.text || '').trim() ? '<i class="fa-solid fa-closed-captioning"></i>' : '') + '</span></div>';
  });
  v += '<button class="addcard" id="tlAdd" aria-label="Ƙara"><i class="fa-solid fa-plus"></i></button></div>';
  const pad = sc.length ? 'margin-left:52px;' : '';
  let a = '<div class="lane a" style="' + pad + '">';
  sc.forEach(s => {
    a += '<div class="seg ' + (s.voId ? 'vo' : 'empty') + '" style="width:' + sceneW(s) + 'px">' + (s.voId ? '<i class="fa-solid fa-microphone"></i>' : '') + '</div>';
  });
  a += '</div>';
  let m = '<div class="lane m" style="' + pad + '">';
  if (sc.length) {
    m += proj.music
      ? '<div class="seg mu" style="width:' + totalW + 'px"><i class="fa-solid fa-music"></i> ' + esc(proj.music.name) + '</div>'
      : '<div class="seg mu none" style="width:' + totalW + 'px"><i class="fa-solid fa-music"></i> Babu kiɗa</div>';
  }
  m += '</div>';
  el.innerHTML = v + a + m + '<div class="ph" id="ph"></div>';
  $('#stageEmpty').classList.toggle('hidden', sc.length > 0);
  movePlayhead();
}

function setSwitch(id, on) {
  $(id).classList.toggle('on', !!on);
}
function selOvObj() {
  const s = curScene();
  return s ? s.overlays.find(o => o.id === selOv) || null : null;
}

function renderOv() {
  const s = curScene();
  const list = $('#ovList');
  if (!s) {
    list.innerHTML = '';
    $('#ovCtl').classList.add('hidden');
    return;
  }
  if (!s.overlays.some(o => o.id === selOv)) selOv = s.overlays.length ? s.overlays[s.overlays.length - 1].id : null;
  list.innerHTML = s.overlays.length ? s.overlays.map(o =>
    '<div class="ovi' + (o.id === selOv ? ' on' : '') + '" data-id="' + o.id + '">' + (o.thumb ? '<img src="' + o.thumb + '" alt="">' : '') +
    '<i class="fa-solid ' + (o.type === 'video' ? 'fa-film' : 'fa-image') + '"></i>' +
    '<button class="rmx" data-rm="' + o.id + '" aria-label="Cire"><i class="fa-solid fa-xmark"></i></button></div>').join('') : '<p class="hint">Babu abin da aka ɗora a kan wannan scene.</p>';
  const o = selOvObj();
  $('#ovCtl').classList.toggle('hidden', !o);
  if (o) {
    $('#ovSize').value = Math.round(o.w * 100);
    $('#ovSizeV').textContent = Math.round(o.w * 100) + '%';
    $('#ovOp').value = Math.round(o.op * 100);
    $('#ovOpV').textContent = Math.round(o.op * 100) + '%';
  }
}

function syncPanel() {
  const s = curScene();
  document.body.classList.toggle('noscene', !s);
  $('#voInfo').textContent = s ? (s.voId ? 'Murya da aka ajiye: ' + fmt1(s.voDur) + (s.voRate !== 1 ? ' (an daidaita: ' + s.voRate.toFixed(2) + 'x)' : '') : 'Babu murya tukuna a wannan scene.') : 'Zaɓi scene a timeline.';
  setSwitch('#swAutoCap', settings.autoCap);
  $('#selAsr').value = settings.asrModel;
  if (proj) {
    $('#voVol').value = Math.round(proj.aud.voVol * 100);
    $('#voVolV').textContent = Math.round(proj.aud.voVol * 100) + '%';
    $('#origVol').value = Math.round(proj.aud.origVol * 100);
    $('#origVolV').textContent = Math.round(proj.aud.origVol * 100) + '%';
    setSwitch('#swOrig', proj.aud.autoMute);
    $('#selCapAnim').value = proj.capAnim;
  }
  $('#micGain').value = settings.micGain;
  $('#micGainV').textContent = settings.micGain + 'x';
  $('#selNr').value = settings.nr;
  $('#selLang').value = settings.lang;
  $('#capSrc').value = settings.capSrc;
  $('#voEdit').classList.toggle('hidden', !(s && s.voId));
  if (s) {
    $('#capText').value = s.text;
    const isV = s.type === 'video';
    $('#trimBox').classList.toggle('hidden', !isV);
    $('#imgBox').classList.toggle('hidden', isV);
    if (isV) {
      $('#trimIn').max = s.srcDur;
      $('#trimOut').max = s.srcDur;
      $('#trimIn').value = s.trimIn;
      $('#trimOut').value = s.trimOut;
      $('#trimInV').textContent = fmt1(s.trimIn);
      $('#trimOutV').textContent = fmt1(s.trimOut);
      $('#selSpeed').value = String(s.speed);
    } else {
      $('#imgDur').value = s.dur;
      $('#imgDurV').textContent = fmt1(s.dur);
    }
    if (s.voId) {
      $('#voCutIn').max = s.voDur;
      $('#voCutOut').max = s.voDur;
      $('#voCutIn').value = 0;
      $('#voCutOut').value = s.voDur;
      $('#voCutInV').textContent = '0.0s';
      $('#voCutOutV').textContent = fmt1(s.voDur);
    }
    $('#selTrans').value = s.trans;
    setSwitch('#swMotion', s.motion);
  } else {
    $('#capText').value = '';
  }
  renderOv();
  const mu = proj && proj.music;
  $('#musName').textContent = mu ? 'Kiɗa: ' + mu.name : 'Babu kiɗa tukuna.';
  $('#musBox').classList.toggle('hidden', !mu);
  $('#btnMusic').innerHTML = '<i class="fa-solid fa-music"></i> ' + (mu ? 'Canja Kiɗa' : 'Ƙara Kiɗa');
  if (proj) {
    $('#musVol').value = Math.round(proj.musicVol * 100);
    $('#musVolV').textContent = Math.round(proj.musicVol * 100) + '%';
    setSwitch('#swDuck', proj.duck);
    setSwitch('#swLogo', proj.logo.center);
    setSwitch('#swLogoOn', proj.logo.on);
    setSwitch('#swLogoAnim', proj.logo.anim);
    $('#logoSize').value = Math.round(proj.logo.size * 100);
    $('#logoSizeV').textContent = Math.round(proj.logo.size * 100) + '%';
    $('#logoOp').value = Math.round(proj.logo.opacity * 100);
    $('#logoOpV').textContent = Math.round(proj.logo.opacity * 100) + '%';
    $('#selAspect').value = proj.aspect;
    $('#selRes').value = String(proj.res);
    $('#selFit').value = proj.fitMode;
    $('#btnOpenOut').classList.toggle('hidden', !(proj.out && !proj.dirty));
  }
}

async function afterEdit(reseek) {
  P.refresh();
  renderTimeline();
  P.ui();
  if (reseek !== false) await P.seek(P.t);
  else P.render();
}

function selectScene(i, seek) {
  selIdx = clamp(i, -1, proj.scenes.length - 1);
  selOv = null;
  renderTimeline();
  syncPanel();
  if (seek && selIdx >= 0 && P.lay[selIdx]) P.seek(P.lay[selIdx].start + 0.01);
}

function show(name) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === name));
}
function openModal(id) {
  $(id).classList.add('open');
}
function closeModal(id) {
  $(id).classList.remove('open');
}

async function updateStorage() {
  let used = 0;
  media.forEach(m => (used += m.size || 0));
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      if (e.usage) used = Math.max(used, e.usage);
    }
  } catch (e) {}
  $('#stoText').textContent = mb(used) + ' · babu iyaka a cikin app';
}

function renderHome() {
  $('#projEmpty').classList.toggle('hidden', projects.length > 0);
  $('#projList').innerHTML = projects.map(p => {
    const d = p.scenes.reduce((a, s) => a + sceneDur(s), 0);
    const th = p.scenes[0] && p.scenes[0].thumb;
    return '<article class="pcard" data-id="' + p.id + '"><div class="pthumb">' +
      (th ? '<img src="' + th + '" alt="">' : '<i class="fa-solid fa-film"></i>') +
      (p.out && !p.dirty ? '<span class="done"><i class="fa-solid fa-circle-check"></i></span>' : '') +
      '</div><div class="pinfo"><b>' + esc(p.name) + '</b><small>' + p.scenes.length + ' scene · ' + fmt(d) + ' · ' +
      new Date(p.updated).toLocaleDateString() + '</small></div>' +
      '<button class="icon-btn del" data-del="' + p.id + '" aria-label="Goge"><i class="fa-solid fa-trash"></i></button></article>';
  }).join('');
  updateStorage();
}

async function purgeBlobs(ids) {
  for (const id of ids) {
    if (!id) continue;
    freeUrl(id);
    await DB.del(id);
  }
}
async function purgeProjectFiles(p) {
  const ids = [];
  p.scenes.forEach(s => ids.push(s.voId));
  if (p.music) ids.push(p.music.id);
  if (p.logo && p.logo.custom) ids.push(p.logo.custom);
  await purgeBlobs(ids);
  await Store.delOut(p.id);
}
async function deleteProject(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  if (!confirm('Za a goge "' + p.name + '". Bidiyo da hotunan da ke cikin app ba za a goge su ba. A ci gaba?')) return;
  await purgeProjectFiles(p);
  projects = projects.filter(x => x.id !== id);
  await saveProjects();
  if (localStorage.getItem(KEY_LAST) === id) localStorage.removeItem(KEY_LAST);
  renderHome();
  toast('An goge project');
}

async function openProject(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  P.reset();
  proj = p;
  localStorage.setItem(KEY_LAST, id);
  $('#edName').value = p.name;
  selIdx = p.scenes.length ? clamp(p.ui.sel >= 0 ? p.ui.sel : 0, 0, p.scenes.length - 1) : -1;
  selOv = null;
  show('editor');
  P.refresh();
  P.t = clamp(p.ui.t || 0, 0, P.total);
  renderTimeline();
  syncPanel();
  setSaved(false);
  loadCustomLogo();
  if (p.scenes.length) await P.seek(P.t);
  else P.render();
}

async function closeEditor() {
  P.pause();
  await persist();
  localStorage.removeItem(KEY_LAST);
  proj = null;
  renderHome();
  show('home');
}

function newProject(name) {
  const base = settings.pd ? JSON.parse(JSON.stringify(settings.pd)) : {};
  const p = normalizeProject(Object.assign(base, { id: uid(), name, created: Date.now(), updated: Date.now(), scenes: [], music: null, out: null }));
  projects.unshift(p);
  saveProjects();
  return p;
}

const lib = { sel: [], insertAt: null, probing: false };

function pickedType(f) {
  const ext = extOf(f.name);
  if (f.type.startsWith('video/') || VEXT.has(ext)) return 'video';
  if (f.type.startsWith('image/') || IEXT.has(ext)) return 'image';
  return null;
}

function addPicked(files) {
  let added = 0;
  let again = 0;
  Array.from(files).forEach(f => {
    const type = pickedType(f);
    if (!type) return;
    const key = keyOf(f);
    if (lib.sel.some(i => i.key === key)) return;
    const m = media.find(x => x.key === key);
    if (m) again++;
    lib.sel.push({
      id: uid(), key, name: f.name, type, file: f, size: f.size, prev: !!m,
      meta: m ? { dur: m.dur, thumb: m.thumb, w: m.w, h: m.h } : null, thumb: m ? m.thumb : '', dur: m ? m.dur : 0
    });
    added++;
  });
  if (!added) toast('Babu sabon bidiyo ko hoto da aka samu');
  else toast('An zaɓi ' + added + (again ? ' · ' + again + ' an taɓa shigar da su (alamar ✔)' : ''));
  refreshBadges();
  renderTray();
  probeQueue();
  const tr = $('#trayItems');
  tr.scrollTop = tr.scrollHeight;
}

async function probeQueue() {
  if (lib.probing) return;
  lib.probing = true;
  try {
    for (;;) {
      const it = lib.sel.find(i => i.file && !i.meta && !i.failed);
      if (!it) break;
      try {
        const meta = it.type === 'video' ? await probeVideo(it.file) : await probeImage(it.file);
        if (!meta || (it.type === 'video' && !meta.dur)) throw new Error('bad');
        it.meta = meta;
        it.thumb = meta.thumb;
        it.dur = meta.dur || 0;
      } catch (e) {
        it.failed = true;
      }
      renderTray(true);
    }
  } finally {
    lib.probing = false;
  }
}

function renderLib() {
  const used = new Set(proj ? proj.scenes.map(s => s.mediaId) : []);
  $('#appCount').textContent = media.length;
  const grid = $('#libGrid');
  if (!media.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><i class="fa-solid fa-box-archive"></i><p>Fayilolin da ka taɓa shigarwa zasu bayyana a nan.</p></div>';
  } else {
    grid.innerHTML = media.slice().sort((a, b) => b.added - a.added).map(m =>
      '<div class="it' + (used.has(m.id) ? ' used' : '') + '" data-reg="' + m.id + '">' + (m.thumb ? '<img src="' + m.thumb + '" alt="">' : '') +
      '<span class="chk"><i class="fa-solid fa-check"></i></span><span class="nb"></span>' +
      '<span class="tp"><i class="fa-solid ' + (m.type === 'video' ? 'fa-play' : 'fa-image') + '"></i>' + (m.dur ? '<b>' + fmt(m.dur) + '</b>' : '') + '</span>' +
      '<button class="rm" data-rm="' + m.id + '" aria-label="Goge daga app"><i class="fa-solid fa-trash"></i></button></div>').join('');
  }
  refreshBadges();
  renderTray();
}

function refreshBadges() {
  const pos = new Map();
  lib.sel.forEach((i, k) => {
    if (i.regId) pos.set(i.regId, k + 1);
  });
  $$('#libGrid .it').forEach(n => {
    const p = pos.get(n.dataset.reg);
    n.classList.toggle('on', !!p);
    n.querySelector('.nb').textContent = p || '';
  });
}

function renderTray(keepScroll) {
  const tray = $('#trayItems');
  const top = tray.scrollTop;
  if (!lib.sel.length) tray.innerHTML = '<span class="tray-hint">Danna “Zaɓi bidiyo / hotuna”. Abin da ka zaɓa zai bayyana a nan, sai ka danna “Ƙara”.</span>';
  else {
    tray.innerHTML = lib.sel.map((it, i) => {
      const th = it.thumb ? '<img src="' + it.thumb + '" alt="">' : it.failed ? '<span class="ph0 bad"><i class="fa-solid fa-triangle-exclamation"></i></span>' : '<span class="ph0"><i class="fa-solid fa-spinner fa-spin"></i></span>';
      return '<div class="ti" data-id="' + it.id + '">' + th + '<b>' + (i + 1) + '</b>' + (it.prev ? '<span class="pv"><i class="fa-solid fa-check"></i></span>' : '') +
        (it.dur ? '<span class="dd">' + fmt(it.dur) + '</span>' : '') + '<span class="tx"><i class="fa-solid fa-xmark"></i></span></div>';
    }).join('');
  }
  if (keepScroll) tray.scrollTop = top;
  $('#trayTitle').textContent = 'Waɗanda ka zaɓa (' + lib.sel.length + ')';
  $('#trayClear').classList.toggle('hidden', !lib.sel.length);
  $('#btnAdd').disabled = !lib.sel.length;
  $('#addCount').textContent = lib.sel.length;
}

function toggleReg(id) {
  const i = lib.sel.findIndex(x => x.regId === id);
  if (i >= 0) lib.sel.splice(i, 1);
  else {
    const m = mediaBy(id);
    if (!m) return;
    lib.sel.push({ id: 'app_' + id + '_' + uid(), regId: id, key: m.key, name: m.name, type: m.type, thumb: m.thumb, dur: m.dur, prev: true, meta: { dur: m.dur, thumb: m.thumb, w: m.w, h: m.h } });
  }
  refreshBadges();
  renderTray();
}

function busy(text, opts = {}) {
  $('#busyText').textContent = text;
  $('#busyBarWrap').classList.toggle('hidden', !opts.bar);
  $('#busyPct').classList.toggle('hidden', !opts.bar);
  $('#busyHint').classList.toggle('hidden', !opts.hint);
  $('#busyCancel').classList.toggle('hidden', !opts.cancel);
  $('#busyX').classList.toggle('hidden', !opts.cancel);
  $('#busyBar').style.width = '0%';
  $('#busyPct').textContent = '0%';
  openModal('#mBusy');
}
function busyProgress(p, text) {
  const v = Math.round(clamp(p, 0, 1) * 100);
  $('#busyBar').style.width = v + '%';
  $('#busyPct').textContent = v + '%';
  if (text) $('#busyText').textContent = text;
}
function unbusy() {
  closeModal('#mBusy');
}

async function addSelected() {
  if (!lib.sel.length || !proj) return;
  const items = lib.sel.slice();
  busy('Ana ƙara fayiloli...', { bar: true });
  let at = lib.insertAt == null ? proj.scenes.length : clamp(lib.insertAt, 0, proj.scenes.length);
  const first = at;
  let ok = 0;
  let failed = 0;
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    busyProgress(k / items.length, 'Ana ƙara ' + (k + 1) + ' daga ' + items.length + '...');
    try {
      let m;
      if (it.regId) m = mediaBy(it.regId);
      else {
        if (it.failed) throw new Error('bad');
        m = await ingest(it.file, it.meta);
      }
      if (!m) throw new Error('x');
      proj.scenes.splice(at++, 0, makeScene(m));
      ok++;
    } catch (e) {
      failed++;
    }
    if (k % 3 === 2) await sleep(0);
  }
  lib.sel = [];
  unbusy();
  if (failed) toast(failed + ' ba a iya ƙara su ba (browser bai goyi bayan format ɗin ba, ko ajiya ta cika)', 5000);
  else toast('An ƙara ' + ok + ' a timeline');
  if (ok) {
    touch();
    await persist();
  }
  show('editor');
  P.idx = -1;
  P.refresh();
  selIdx = ok ? first : selIdx;
  renderTimeline();
  syncPanel();
  if (proj.scenes.length) await P.seek(ok ? P.lay[first].start + 0.01 : P.t);
}

async function removeMedia(id) {
  const m = mediaBy(id);
  if (!m) return;
  let uses = 0;
  projects.forEach(p => p.scenes.forEach(s => {
    if (s.mediaId === id) uses++;
  }));
  const msg = uses
    ? '"' + m.name + '" ana amfani da shi a ' + uses + ' scene. Idan ka goge shi daga app, za a cire waɗannan scenes. A goge?'
    : 'A goge "' + m.name + '" daga app gaba ɗaya?';
  if (!confirm(msg)) return;
  for (const p of projects) {
    const keep = [];
    for (const s of p.scenes) {
      if (s.mediaId === id) await purgeBlobs([s.voId]);
      else keep.push(s);
    }
    p.scenes = keep;
    p.scenes.forEach(s => (s.overlays = s.overlays.filter(o => o.mediaId !== id)));
  }
  media = media.filter(x => x.id !== id);
  ovImgs.delete(id);
  await purgeBlobs([id]);
  await saveMedia();
  await saveProjects();
  lib.sel = lib.sel.filter(x => x.regId !== id);
  if (P.vidId === id) P.vidId = null;
  if (P.imgId === id) P.imgId = null;
  P.idx = -1;
  if (proj) {
    P.refresh();
    selIdx = proj.scenes.length ? clamp(selIdx, 0, proj.scenes.length - 1) : -1;
  }
  renderLib();
  toast('An goge daga app');
}

function openLibrary(at) {
  lib.insertAt = at == null ? null : at;
  lib.sel = [];
  $('#libTitle').textContent = at == null || !proj || at >= proj.scenes.length ? 'Ƙara a ƙarshe' : at === 0 ? 'Ƙara a farko' : 'Ƙara a scene ' + (at + 1);
  renderLib();
  show('library');
}

const SQ = 1;
function wavBlob(int16, rate) {
  const n = int16.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, SQ, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, int16[i], true);
  return new Blob([buf], { type: 'audio/wav' });
}

async function decodeMono(blob) {
  const ab = await blob.arrayBuffer();
  let buf;
  try {
    const oc = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
    buf = await oc.decodeAudioData(ab.slice(0));
  } catch (e) {
    const C = window.AudioContext || window.webkitAudioContext;
    const c = new C();
    try {
      buf = await c.decodeAudioData(ab.slice(0));
    } finally {
      try {
        c.close();
      } catch (e2) {}
    }
  }
  const n = buf.length;
  const d = new Float32Array(n);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const x = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] += x[i] / buf.numberOfChannels;
  }
  return { d, rate: buf.sampleRate };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const nc = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nc;
      }
    }
  }
}

async function denoise(d, level) {
  const N = 1024;
  const H = 256;
  const nb = N / 2 + 1;
  if (d.length < N * 6) return d;
  const frames = Math.floor((d.length - N) / H) + 1;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const energy = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const o = f * H;
    for (let i = 0; i < N; i += 4) e += d[o + i] * d[o + i];
    energy[f] = e;
  }
  const order = Array.from(energy.keys()).sort((a, b) => energy[a] - energy[b]);
  const take = clamp(Math.floor(frames * 0.12), 6, 500);
  const noise = new Float64Array(nb);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let q = 0; q < take; q++) {
    const o = order[q] * H;
    for (let i = 0; i < N; i++) {
      re[i] = d[o + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < nb; k++) noise[k] += Math.hypot(re[k], im[k]) / take;
  }
  const alpha = level === 'low' ? 1.3 : level === 'medium' ? 1.9 : 2.7;
  const floor = level === 'low' ? 0.14 : level === 'medium' ? 0.08 : 0.035;
  const out = new Float32Array(d.length);
  const prev = new Float64Array(nb).fill(1);
  const gain = new Float64Array(nb);
  const sm = new Float64Array(nb);
  for (let f = 0; f < frames; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) {
      re[i] = d[o + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < nb; k++) {
      const mag = Math.hypot(re[k], im[k]) + 1e-9;
      let g = Math.max(floor, (mag - alpha * noise[k]) / mag);
      g = g > prev[k] ? g : prev[k] * 0.65 + g * 0.35;
      gain[k] = g;
    }
    for (let k = 0; k < nb; k++) {
      const a = gain[Math.max(0, k - 1)];
      const b = gain[Math.min(nb - 1, k + 1)];
      sm[k] = (a + gain[k] * 2 + b) / 4;
      prev[k] = gain[k];
    }
    for (let k = 0; k < nb; k++) {
      re[k] *= sm[k];
      im[k] *= sm[k];
      if (k > 0 && k < N / 2) {
        re[N - k] = re[k];
        im[N - k] = -im[k];
      }
    }
    for (let i = 0; i < N; i++) im[i] = -im[i];
    fft(re, im);
    for (let i = 0; i < N; i++) out[o + i] += re[i] / N * win[i] / 1.5;
    if (f % 120 === 0) await sleep(0);
  }
  return out;
}

function gateNormalize(d, rate, level) {
  const W = Math.max(1, Math.round(rate * 0.02));
  const nW = Math.floor(d.length / W);
  if (nW < 5) return null;
  const rms = new Float64Array(nW);
  for (let w = 0; w < nW; w++) {
    let q = 0;
    const o = w * W;
    for (let i = 0; i < W; i++) q += d[o + i] * d[o + i];
    rms[w] = Math.sqrt(q / W);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const noise = sorted[Math.floor(nW * 0.1)];
  const hi = sorted[Math.floor(nW * 0.95)];
  if (hi < 0.002) return null;
  const thr = Math.min(hi * 0.5, Math.max(noise * 3, hi * 0.1));
  const open = new Uint8Array(nW);
  for (let w = 0; w < nW; w++) open[w] = rms[w] > thr ? 1 : 0;
  const look = 5;
  const hold = 16;
  const gate = new Float64Array(nW);
  let last = -1000;
  const opened = new Uint8Array(nW);
  for (let w = 0; w < nW; w++) {
    if (open[w]) {
      for (let k = Math.max(0, w - look); k <= w; k++) opened[k] = 1;
      last = w;
    } else if (w - last <= hold) opened[w] = 1;
  }
  const closedGain = level === 'low' ? 0.25 : level === 'medium' ? 0.08 : 0.015;
  for (let w = 0; w < nW; w++) gate[w] = opened[w] ? 1 : closedGain;
  let first = -1;
  let lastOpen = -1;
  for (let w = 0; w < nW; w++) {
    if (open[w]) {
      if (first < 0) first = w;
      lastOpen = w;
    }
  }
  if (first < 0) return null;
  let q = 0;
  let c = 0;
  for (let w = first; w <= lastOpen; w++) {
    if (open[w]) {
      q += rms[w] * rms[w];
      c++;
    }
  }
  const speech = Math.sqrt(q / Math.max(1, c));
  const g = clamp(0.22 / Math.max(speech, 1e-4), 1, 12);
  const s0 = Math.max(0, (first - 8) * W);
  const s1 = Math.min(d.length, (lastOpen + 16) * W);
  const out = new Int16Array(s1 - s0);
  const th = Math.tanh(1.1);
  for (let i = s0; i < s1; i++) {
    const w = Math.min(nW - 1, Math.floor(i / W));
    const w2 = Math.min(nW - 1, w + 1);
    const frac = (i - w * W) / W;
    const gt = gate[w] * (1 - frac) + gate[w2] * frac;
    const x = d[i] * gt * g;
    out[i - s0] = Math.round(Math.tanh(x * 1.1) / th * 0.97 * 32767);
  }
  return { blob: wavBlob(out, rate), dur: out.length / rate };
}

async function processVoice(blob, fallbackDur, level) {
  try {
    const { d, rate } = await decodeMono(blob);
    const dn = await denoise(d, level || settings.nr);
    const r = gateNormalize(dn, rate, level || settings.nr);
    if (r && r.dur > 0.15) return r;
    return { blob, dur: (await mediaDuration(blob)) || fallbackDur };
  } catch (e) {
    return { blob, dur: (await mediaDuration(blob)) || fallbackDur };
  }
}

async function replaceVoice(s, blob, dur) {
  const id = uid();
  await DB.put(id, blob);
  const old = s.voId;
  s.voId = id;
  s.voDur = dur;
  if (old) {
    if (P.voId === old) P.voId = null;
    await purgeBlobs([old]);
  }
}

function micConstraints(deviceId) {
  const a = { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: { ideal: 1 }, voiceIsolation: true };
  if (deviceId) a.deviceId = { exact: deviceId };
  return { audio: a };
}
async function openMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Wannan browser ba ya iya rikodin murya. Yi amfani da Chrome ta HTTPS.');
    return null;
  }
  let stream = null;
  if (settings.micId) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(micConstraints(settings.micId));
    } catch (e) {
      if (e && e.name === 'NotAllowedError') {
        toast('Ba a ba da izinin makirufo ba');
        return null;
      }
      settings.micId = '';
      saveJSON(KEY_SET, settings);
      toast('Makirufon da ka zaɓa ba a same shi ba. Ana amfani da makirufo na asali.', 4200);
    }
  }
  if (!stream) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(micConstraints(''));
    } catch (e) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e2) {
        toast(e2 && e2.name === 'NotFoundError' ? 'Ba a samu makirufo ba. Haɗa makirufo ka sake gwadawa.' : 'Ba a ba da izinin makirufo ba');
        return null;
      }
    }
  }
  refreshMics();
  const t = stream.getAudioTracks()[0];
  if (t && t.label) toast('Makirufo: ' + t.label, 2200);
  return stream;
}
async function refreshMics() {
  const sel = $('#selMic');
  if (!sel || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  let list = [];
  try {
    list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId !== 'communications');
  } catch (e) {
    return;
  }
  const seen = new Set();
  let n = 0;
  let h = '<option value="">Makirufo na asali na na\'ura</option>';
  list.forEach(d => {
    if (d.deviceId === 'default' || seen.has(d.groupId + d.label)) return;
    seen.add(d.groupId + d.label);
    n++;
    h += '<option value="' + esc(d.deviceId) + '">' + esc(d.label || 'Makirufo ' + n) + '</option>';
  });
  sel.innerHTML = h;
  if (settings.micId && !Array.from(sel.options).some(o => o.value === settings.micId)) {
    settings.micId = '';
    saveJSON(KEY_SET, settings);
  }
  sel.value = settings.micId;
}
function setupMicPicker() {
  const btn = $('#btnRec');
  if (!btn || $('#selMic')) return;
  btn.insertAdjacentHTML('afterend',
    '<label class="fld"><span><i class="fa-solid fa-plug"></i> Makirufo (na ciki, na waya, Bluetooth ko USB)</span>' +
    '<span class="row"><select id="selMic"></select><button id="btnMicRef" class="btn slim" type="button" aria-label="Sabunta jerin"><i class="fa-solid fa-rotate"></i></button></span></label>');
  $('#selMic').addEventListener('change', e => {
    settings.micId = e.target.value;
    saveJSON(KEY_SET, settings);
    toast(settings.micId ? 'An zaɓi makirufo' : 'An dawo da makirufo na asali');
  });
  $('#btnMicRef').onclick = async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      st.getTracks().forEach(t => t.stop());
    } catch (e) {
      toast('Ba a ba da izinin makirufo ba');
    }
    await refreshMics();
    toast('An sabunta jerin makirufo');
  };
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', refreshMics);
  }
  refreshMics();
}

const Rec = { cancel: false, pending: null, abort: null, url: '' };

async function recordFlow() {
  const s = curScene();
  if (!s) return toast('Zaɓi scene tukuna');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    return toast('Wannan browser ba ya iya rikodin murya. Yi amfani da Chrome ta HTTPS.');
  }
  P.pause();
  const stream = await openMic();
  if (!stream) return;
  Rec.cancel = false;
  Rec.abort = null;
  const idx = selIdx;
  const micTrack = stream.getAudioTracks()[0];
  if (micTrack) {
    micTrack.onended = () => {
      if (Rec.abort) {
        toast('An cire makirufo. An ajiye abin da aka yi rikodi.');
        Rec.abort();
      } else Rec.cancel = true;
    };
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  const C = new AC();
  try {
    await C.resume();
  } catch (e) {}
  const src = C.createMediaStreamSource(stream);
  const hp = C.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 120;
  hp.Q.value = 0.8;
  const lp = C.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7500;
  const an = C.createAnalyser();
  an.fftSize = 1024;
  const pre = C.createGain();
  pre.gain.value = settings.micGain;
  const comp = C.createDynamicsCompressor();
  comp.threshold.value = -34;
  comp.knee.value = 18;
  comp.ratio.value = 5;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  const mk = C.createGain();
  mk.gain.value = 1.6;
  const gate = C.createGain();
  gate.gain.value = 0.03;
  const dest = C.createMediaStreamDestination();
  src.connect(hp);
  hp.connect(lp);
  lp.connect(an);
  lp.connect(pre);
  pre.connect(comp);
  comp.connect(mk);
  mk.connect(gate);
  gate.connect(dest);
  const buf = new Float32Array(an.fftSize);
  const lvl = () => {
    an.getFloatTimeDomainData(buf);
    let q = 0;
    for (let i = 0; i < buf.length; i++) q += buf[i] * buf[i];
    return Math.sqrt(q / buf.length);
  };
  let mr = null;
  let gateTimer = 0;
  let clockTimer = 0;
  let recording = false;

  const cleanup = () => {
    recording = false;
    clearInterval(gateTimer);
    clearInterval(clockTimer);
    stream.getTracks().forEach(t => t.stop());
    try {
      C.close();
    } catch (e) {}
    P.recMode = false;
    P.stopAt = null;
    P.pause();
    P.applyGains();
    closeModal('#mRec');
  };

  $('#recNote').classList.add('hidden');
  $('#recStop').classList.add('hidden');
  $('#recCancel').classList.remove('hidden');
  $('#recMeter').style.width = '0%';
  $('#recTime').textContent = '0:00';
  openModal('#mRec');

  const samples = [];
  const cd = $('#recCount');
  for (let k = 3; k >= 1 && !Rec.cancel; k--) {
    cd.textContent = k;
    const end = performance.now() + 1000;
    while (performance.now() < end && !Rec.cancel) {
      const l = lvl();
      samples.push(l);
      $('#recMeter').style.width = clamp(l * 600, 0, 100) + '%';
      await sleep(40);
    }
  }
  if (Rec.cancel) {
    cleanup();
    return;
  }
  samples.sort((a, b) => a - b);
  const floor = samples[Math.floor(samples.length * 0.9)] || 0.003;
  const thr = Math.max(0.007, floor * 2.6);
  cd.textContent = 'Fara!';
  let hold = 0;
  gateTimer = setInterval(() => {
    const l = lvl();
    const now = performance.now();
    if (l > thr) hold = now + 420;
    const open = now < hold;
    gate.gain.setTargetAtTime(open ? 1 : 0.03, C.currentTime, open ? 0.01 : 0.12);
    $('#recMeter').style.width = clamp(l * 600, 0, 100) + '%';
  }, 25);

  const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const chunks = [];
  try {
    mr = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
  } catch (e) {
    cleanup();
    return toast('Ba a iya fara rikodi ba');
  }
  mr.ondataavailable = e => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  P.recMode = true;
  A.init();
  await A.resume();
  P.applyGains();
  await P.seek(P.lay[idx].start);
  P.stopAt = P.lay[idx].start + P.lay[idx].dur;
  let t0 = 0;
  recording = true;
  await P.play(() => {
    t0 = performance.now();
    mr.start(250);
  });
  if (!t0) {
    t0 = performance.now();
    if (mr.state === 'inactive') mr.start(250);
  }
  if (Rec.cancel) {
    cleanup();
    return;
  }
  $('#recCancel').classList.add('hidden');
  $('#recStop').classList.remove('hidden');
  clockTimer = setInterval(() => {
    const el = (performance.now() - t0) / 1000;
    $('#recTime').textContent = fmt(el);
    if (!P.playing && P.stopAt != null && P.t >= P.stopAt - 0.02) {
      $('#recNote').textContent = 'Scene ya ƙare. Idan ka gama magana danna “Tsaya”.';
      $('#recNote').classList.remove('hidden');
    }
  }, 200);

  await new Promise(res => {
    Rec.abort = res;
    $('#recStop').onclick = () => {
      $('#recStop').onclick = null;
      res();
    };
  });
  Rec.abort = null;
  const elapsed = (performance.now() - t0) / 1000;
  const wasCancel = Rec.cancel;
  await new Promise(res => {
    mr.onstop = res;
    try {
      mr.stop();
    } catch (e) {
      res();
    }
  });
  cleanup();
  if (wasCancel || !chunks.length) return;
  busy('Ana tsabtace murya, a jira...');
  const out = await processVoice(new Blob(chunks, { type: mime || 'audio/webm' }), elapsed);
  unbusy();
  if (!out.dur || out.dur < 0.2) return toast('Rikodin ya yi gajarta ko babu magana a ciki');
  Rec.pending = { blob: out.blob, dur: out.dur, idx };
  if (Rec.url) URL.revokeObjectURL(Rec.url);
  Rec.url = URL.createObjectURL(out.blob);
  $('#revAudio').src = Rec.url;
  $('#revInfo').textContent = 'Tsawo: ' + fmt1(out.dur);
  openModal('#mReview');
}

function fitToVoice(silent) {
  const s = curScene();
  if (!s || !s.voId) return false;
  if (s.type === 'video') {
    const clip0 = s.trimOut - s.trimIn;
    const sp = clamp(clip0 / s.voDur, 0.5, 2);
    s.speed = Math.round(sp * 100) / 100;
    const cd = clip0 / s.speed;
    s.voRate = 1;
    if (s.voDur > cd + 0.05) s.voRate = Math.round(clamp(s.voDur / cd, 1, 1.5) * 100) / 100;
    if (!silent) toast('Gudun bidiyo: ' + s.speed + 'x' + (s.voRate > 1 ? ', gudun murya: ' + s.voRate + 'x' : ''));
  } else {
    s.dur = clamp(Math.ceil(s.voDur * 2) / 2, 1, 30);
    s.voRate = 1;
    if (!silent) toast('Tsawon hoto: ' + fmt1(s.dur));
  }
  return true;
}

async function saveVoice() {
  const r = Rec.pending;
  if (!r || !proj) return;
  const s = proj.scenes[r.idx];
  closeModal('#mReview');
  $('#revAudio').pause();
  if (!s) return;
  busy('Ana ajiye murya...');
  try {
    await replaceVoice(s, r.blob, r.dur);
    s.voRate = 1;
    s.caps = null;
    selIdx = r.idx;
    const longer = r.dur > clipDur(s) + 0.1;
    if (longer) fitToVoice(true);
    Rec.pending = null;
    touch();
    await persist();
    P.refresh();
    renderTimeline();
    syncPanel();
    unbusy();
    toast(longer ? 'An daidaita scene da tsawon murya.' : 'An saka murya a scene ' + (r.idx + 1) + '.');
    await P.seek(P.lay[r.idx].start + 0.01);
    if (settings.autoCap) setTimeout(() => transcribeScene(r.idx, 'vo'), 250);
  } catch (e) {
    unbusy();
    toast('Ba a iya ajiye murya ba, ajiya ta cika');
  }
}

async function voiceCut() {
  const s = curScene();
  if (!s || !s.voId) return;
  const a = parseFloat($('#voCutIn').value);
  const b = parseFloat($('#voCutOut').value);
  if (b - a < 0.2) return toast('Yanka ta yi ƙanƙanta');
  busy('Ana yanke murya...');
  try {
    const blob = await DB.get(s.voId);
    const { d, rate } = await decodeMono(blob);
    const i0 = Math.floor(a * rate);
    const i1 = Math.min(d.length, Math.ceil(b * rate));
    const out = new Int16Array(i1 - i0);
    for (let i = i0; i < i1; i++) out[i - i0] = Math.round(clamp(d[i], -1, 1) * 32767);
    await replaceVoice(s, wavBlob(out, rate), out.length / rate);
    s.voRate = 1;
    touch();
    await afterEdit();
    syncPanel();
    toast('An yanke murya');
  } catch (e) {
    toast('Ba a iya yanke murya ba');
  }
  unbusy();
}
async function voiceClean() {
  const s = curScene();
  if (!s || !s.voId) return;
  busy('Ana tsabtace murya sosai...');
  try {
    const blob = await DB.get(s.voId);
    const out = await processVoice(blob, s.voDur, 'high');
    await replaceVoice(s, out.blob, out.dur);
    touch();
    await afterEdit();
    syncPanel();
    toast('An tsabtace murya');
  } catch (e) {
    toast('Ba a iya tsabtace murya ba');
  }
  unbusy();
}

const ASR_SRC = [
  "import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';",
  "env.allowLocalModels = false;",
  "env.useBrowserCache = true;",
  "let pipe = null;",
  "let name = '';",
  "self.onmessage = async e => {",
  "  const m = e.data;",
  "  try {",
  "    if (!pipe || name !== m.model) {",
  "      pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-' + m.model, { progress_callback: p => self.postMessage({ type: 'progress', p }) });",
  "      name = m.model;",
  "    }",
  "    self.postMessage({ type: 'status', text: 'run' });",
  "    const out = await pipe(m.audio, { language: m.language || undefined, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });",
  "    self.postMessage({ type: 'done', out });",
  "  } catch (err) {",
  "    self.postMessage({ type: 'error', message: String((err && err.message) || err) });",
  "  }",
  "};"
].join('\n');
const WLANG = { en: 'english', ha: 'hausa', yo: 'yoruba', sw: 'swahili', fr: 'french', ar: 'arabic', es: 'spanish', pt: 'portuguese', de: 'german', hi: 'hindi', zh: 'chinese', tr: 'turkish', ru: 'russian' };
const ASR = { worker: null, reject: null };
let asrCancel = false;

function asrRun(audio, model, language, onMsg) {
  return new Promise((resolve, reject) => {
    if (!ASR.worker) {
      const url = URL.createObjectURL(new Blob([ASR_SRC], { type: 'text/javascript' }));
      ASR.worker = new Worker(url, { type: 'module' });
    }
    const w = ASR.worker;
    ASR.reject = reject;
    w.onmessage = e => {
      const m = e.data;
      if (m.type === 'done') resolve(m.out);
      else if (m.type === 'error') reject(new Error(m.message));
      else onMsg(m);
    };
    w.onerror = e => reject(new Error(e.message || 'worker'));
    w.postMessage({ model, language, audio }, [audio.buffer]);
  });
}
function asrAbort() {
  asrCancel = true;
  if (ASR.worker) {
    ASR.worker.terminate();
    ASR.worker = null;
  }
  if (ASR.reject) ASR.reject(new Error('cancel'));
  P.pause();
}

function resample16(d, rate) {
  if (rate === 16000) return d;
  const ratio = rate / 16000;
  const m = Math.floor(d.length / ratio);
  const out = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const pp = i * ratio;
    const j = Math.floor(pp);
    const f = pp - j;
    out[i] = d[j] * (1 - f) + (d[j + 1] !== undefined ? d[j + 1] : d[j]) * f;
  }
  return out;
}
async function decode16k(blob) {
  const ab = await blob.arrayBuffer();
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  let buf;
  try {
    buf = await new Off(1, 1, 16000).decodeAudioData(ab.slice(0));
  } catch (e) {
    const C = window.AudioContext || window.webkitAudioContext;
    const c = new C();
    try {
      buf = await c.decodeAudioData(ab.slice(0));
    } finally {
      try {
        c.close();
      } catch (e2) {}
    }
  }
  const n = buf.length;
  const d = new Float32Array(n);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const x = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] += x[i] / buf.numberOfChannels;
  }
  return resample16(d, buf.sampleRate);
}

async function captureScene(idx) {
  A.init();
  await A.resume();
  const rate = A.ctx.sampleRate;
  const sp = A.ctx.createScriptProcessor(4096, 1, 1);
  const z = A.ctx.createGain();
  z.gain.value = 0;
  const parts = [];
  sp.onaudioprocess = e => parts.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  A.gV.connect(sp);
  sp.connect(z);
  z.connect(A.ctx.destination);
  P.stt = 'orig';
  P.stopAt = null;
  await P.seek(P.lay[idx].start);
  P.stopAt = P.lay[idx].start + P.lay[idx].dur;
  P.applyGains();
  await P.play();
  while (P.playing && !asrCancel) {
    busyProgress((P.t - P.lay[idx].start) / Math.max(0.1, P.lay[idx].dur), 'Ana karanta sautin bidiyo (yana wasa a hankali)...');
    await sleep(200);
  }
  P.pause();
  P.stt = null;
  P.stopAt = null;
  P.applyGains();
  try {
    A.gV.disconnect(sp);
    sp.disconnect();
    z.disconnect();
  } catch (e) {}
  let n = 0;
  parts.forEach(x => (n += x.length));
  const all = new Float32Array(n);
  let o = 0;
  parts.forEach(x => {
    all.set(x, o);
    o += x.length;
  });
  return resample16(all, rate);
}

const cleanCap = t => t.replace(/\[[^\]]*\]|\([^)]*\)|♪[^♪]*♪|♪/g, ' ').replace(/\s+/g, ' ').trim();

async function transcribeScene(idx, source) {
  const s = proj && proj.scenes[idx];
  if (!s) return toast('Zaɓi scene tukuna');
  if (source === 'vo' && !s.voId) return toast('Wannan scene ba ta da murya da aka yi rikodi');
  if (source === 'orig' && s.type !== 'video') return toast('Hoto ba shi da sautin asali');
  if (typeof Worker === 'undefined') return toast('Wannan browser ba ya goyon bayan wannan aikin');
  asrCancel = false;
  busy('Ana shirya rubutu...', { bar: true, cancel: true });
  $('#busyCancel').onclick = asrAbort;
  $('#busyX').onclick = asrAbort;
  const restore = () => {
    $('#busyCancel').onclick = cancelExport;
    $('#busyX').onclick = cancelExport;
    unbusy();
  };
  try {
    busyProgress(0, 'Ana karanta sauti...');
    let audio;
    let toLocal;
    if (source === 'vo') {
      audio = await decode16k(await DB.get(s.voId));
      toLocal = t => t / (s.voRate || 1);
    } else {
      const f = await DB.get(s.mediaId);
      audio = null;
      if (f && f.size <= 200 * 1048576) {
        try {
          const all = await decode16k(f);
          audio = all.slice(Math.floor(s.trimIn * 16000), Math.ceil(s.trimOut * 16000));
          toLocal = t => t / s.speed;
        } catch (e) {
          audio = null;
        }
      }
      if (!audio) {
        audio = await captureScene(idx);
        toLocal = t => t;
      }
    }
    if (asrCancel) throw new Error('cancel');
    let q = 0;
    for (let i = 0; i < audio.length; i += 8) q += audio[i] * audio[i];
    if (!audio.length || Math.sqrt(q / Math.max(1, audio.length / 8)) < 0.002) throw new Error('nospeech');
    const lang = settings.lang === 'auto' ? undefined : WLANG[settings.lang.slice(0, 2)];
    const files = {};
    busyProgress(0, 'Ana sauke samfurin rubutu (sau ɗaya kawai, sai ya zauna a na\'ura)...');
    const out = await asrRun(audio.slice(), settings.asrModel, lang, m => {
      if (m.type === 'progress' && m.p && typeof m.p.progress === 'number' && m.p.file) {
        files[m.p.file] = m.p.progress;
        const v = Object.values(files);
        busyProgress(v.reduce((a, b) => a + b, 0) / v.length / 100);
      } else if (m.type === 'status') {
        busyProgress(0.97, 'Ana rubuta abin da ake faɗi... (jira kaɗan)');
      }
    });
    if (asrCancel) throw new Error('cancel');
    const dur = sceneDur(s);
    const caps = [];
    (out.chunks || []).forEach((c, i, arr) => {
      const t0 = c.timestamp && c.timestamp[0] != null ? c.timestamp[0] : 0;
      const t1 = c.timestamp && c.timestamp[1] != null ? c.timestamp[1] : t0 + 3;
      const text = cleanCap(c.text || '');
      if (!text) return;
      if (caps.length && caps[caps.length - 1].text === text) return;
      caps.push({ a: clamp(toLocal(t0), 0, dur), b: clamp(toLocal(t1), 0, dur), text });
    });
    if (!caps.length && out.text && cleanCap(out.text)) caps.push({ a: 0, b: dur, text: cleanCap(out.text) });
    if (!caps.length) throw new Error('nospeech');
    for (let i = 0; i < caps.length; i++) {
      if (caps[i].b <= caps[i].a) caps[i].b = i + 1 < caps.length ? caps[i + 1].a : dur;
    }
    s.caps = caps;
    s.text = caps.map(c => c.text).join(' ');
    s.capsFor = s.text;
    restore();
    touch();
    syncPanel();
    renderTimeline();
    P.render();
    toast('An rubuta rubutu a scene ' + (idx + 1));
  } catch (e) {
    restore();
    P.stt = null;
    P.stopAt = null;
    P.applyGains();
    const m = e && e.message;
    if (m === 'cancel') toast('An soke');
    else if (m === 'nospeech') toast('Ba a ji magana ba. Duba harshen da ka zaɓa da ƙarfin sauti.');
    else toast('Ba a iya rubuta ba. Ana buƙatar intanet a karon farko don sauke samfurin. (' + (m || 'error') + ')', 6000);
  }
}

async function boostVoice(all) {
  if (!proj) return;
  const targets = all ? proj.scenes.filter(x => x.voId) : [curScene()].filter(x => x && x.voId);
  if (!targets.length) return toast('Babu murya da za a ƙara');
  busy('Ana ƙara ƙarfin murya...', { bar: true });
  let k = 0;
  for (const s of targets) {
    try {
      const { d, rate } = await decodeMono(await DB.get(s.voId));
      const out = new Int16Array(d.length);
      const th = Math.tanh(1.3);
      for (let i = 0; i < d.length; i++) out[i] = Math.round(Math.tanh(d[i] * 2.2 * 1.3) / th * 0.98 * 32767);
      await replaceVoice(s, wavBlob(out, rate), d.length / rate);
    } catch (e) {}
    k++;
    busyProgress(k / targets.length);
  }
  unbusy();
  touch();
  await afterEdit();
  syncPanel();
  toast(all ? 'An ƙara murya a duka scenes' : 'An ƙara ƙarfin murya');
}

function pickMime() {
  const list = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

let exportJob = null;
function cancelExport() {
  if (exportJob) {
    exportJob.cancel = true;
    if (exportJob.abort) exportJob.abort();
  }
}
async function exportVideo() {
  if (!proj || !proj.scenes.length) {
    toast('Ƙara bidiyo ko hoto tukuna');
    return false;
  }
  if (!window.MediaRecorder) {
    toast('Wannan browser ba ya goyon bayan hadawa');
    return false;
  }
  P.pause();
  A.init();
  await A.resume();
  const d = dims(proj.aspect, proj.res);
  const cvx = document.createElement('canvas');
  cvx.width = d.w;
  cvx.height = d.h;
  const g = cvx.getContext('2d');
  const stream = cvx.captureStream(30);
  const at = A.rec.stream.getAudioTracks()[0];
  if (at) stream.addTrack(at);
  const mime = pickMime();
  const bps = { 480: 2500000, 720: 5000000, 1080: 9000000 }[proj.res] || 5000000;
  let mr;
  try {
    mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: bps, audioBitsPerSecond: 192000 } : { videoBitsPerSecond: bps });
  } catch (e) {
    toast('Ba a iya fara hadawa ba');
    return false;
  }
  const out = await Store.openOut(proj.id);
  const chunks = [];
  let queue = Promise.resolve();
  let writeFail = false;
  mr.ondataavailable = e => {
    if (!e.data || !e.data.size) return;
    if (out) queue = queue.then(() => out.w.write(e.data)).catch(() => (writeFail = true));
    else chunks.push(e.data);
  };
  const job = { cancel: false };
  exportJob = job;
  let wake = null;
  try {
    if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen');
  } catch (e) {}
  busy('Ana haɗa bidiyo...', { bar: true, hint: true, cancel: true });
  $('#busyCancel').onclick = cancelExport;
  $('#busyX').onclick = cancelExport;
  const prog = setInterval(() => busyProgress(P.total ? P.t / P.total : 0, 'Ana haɗa bidiyo... ' + fmt(P.t) + ' / ' + fmt(P.total)), 300);
  A.mon.gain.value = 0;
  P.exporting = { g, w: d.w, h: d.h };
  const prevSel = selIdx;
  try {
    await P.seek(0);
    P.render();
    mr.start(1000);
    await new Promise(res => {
      P.onEnd = res;
      job.abort = res;
      P.play();
    });
    await sleep(350);
  } catch (e) {
    job.cancel = true;
  }
  P.onEnd = null;
  clearInterval(prog);
  P.exporting = null;
  A.mon.gain.value = 1;
  if (wake) {
    try {
      wake.release();
    } catch (e) {}
  }
  await new Promise(res => {
    mr.onstop = res;
    try {
      if (mr.state !== 'inactive') mr.stop();
      else res();
    } catch (e) {
      res();
    }
  });
  await queue;
  if (out) {
    try {
      await out.w.close();
    } catch (e) {
      writeFail = true;
    }
  }
  P.pause();
  selIdx = prevSel;
  exportJob = null;
  if (job.cancel || writeFail) {
    unbusy();
    toast(job.cancel ? 'An soke hadawa' : 'Ba a iya rubuta bidiyo ba, ajiya ta cika');
    await Store.delOut(proj.id);
    await P.seek(0);
    return false;
  }
  busyProgress(1, 'Ana ajiyewa...');
  try {
    const type = (mime || 'video/webm').split(';')[0];
    let size = 0;
    if (out) {
      const f = await Store.getOut(proj.id, type);
      size = f.size;
    } else {
      const blob = new Blob(chunks, { type });
      size = blob.size;
      await DB.put('out_' + proj.id, blob);
    }
    proj.out = { type, ext: type.includes('mp4') ? 'mp4' : 'webm', size, date: Date.now(), res: proj.res, aspect: proj.aspect, w: d.w, h: d.h };
    proj.dirty = false;
    await persist();
    unbusy();
    syncPanel();
    await P.seek(0);
    await showResult();
    return true;
  } catch (e) {
    unbusy();
    toast('Ba a iya ajiye bidiyo ba, ajiya ta cika');
    return false;
  }
}

let resUrl = '';
async function showResult() {
  if (!proj || !proj.out) return;
  const b = await Store.getOut(proj.id, proj.out.type);
  if (!b) return toast('Babu bidiyon da aka gama');
  const v = $('#resVid');
  if (resUrl) URL.revokeObjectURL(resUrl);
  resUrl = URL.createObjectURL(b);
  v.onloadedmetadata = () => {
    if (v.duration === Infinity) {
      v.currentTime = 1e101;
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        v.currentTime = 0;
      };
    }
  };
  const o = proj.out;
  const portrait = o.h >= o.w;
  v.style.aspectRatio = (o.w || 9) + ' / ' + (o.h || 16);
  v.style.height = portrait ? '58dvh' : 'auto';
  v.style.width = portrait ? 'auto' : '100%';
  v.src = resUrl;
  $('#resInfo').textContent = o.res + 'p · ' + o.aspect + ' · ' + mb(b.size) + ' · .' + o.ext;
  openModal('#mResult');
}

const safeName = () => (proj.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'project');

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 8000);
}

function projectJson() {
  const copy = JSON.parse(JSON.stringify(proj));
  copy.scenes.forEach(s => delete s.thumb);
  return new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' });
}

async function writeFile(dir, name, blob) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

async function saveDevice() {
  if (!proj) return;
  if (!proj.out || proj.dirty) {
    toast('Za a fara haɗa bidiyo tukuna');
    closeModal('#mResult');
    await exportVideo();
    return;
  }
  const b = await Store.getOut(proj.id, proj.out.type);
  if (!b) return toast('Babu bidiyon da aka gama');
  const name = safeName();
  const file = name + '.' + proj.out.ext;
  if (window.showDirectoryPicker) {
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      const sub = await dir.getDirectoryHandle(name, { create: true });
      await writeFile(sub, file, b);
      await writeFile(sub, name + '.project.json', projectJson());
      toast('An ajiye a folder "' + name + '"');
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  download(b, file);
  setTimeout(() => download(projectJson(), name + '.project.json'), 800);
  toast('An sauke "' + file + '" a na\'urarka');
}

async function shareToApps() {
  if (!proj) return;
  if (!proj.out || proj.dirty) {
    toast('Za a fara haɗa bidiyo tukuna');
    closeModal('#mResult');
    await exportVideo();
    return;
  }
  const b = await Store.getOut(proj.id, proj.out.type);
  if (!b) return toast('Babu bidiyon da aka gama');
  const f = new File([b], safeName() + '.' + proj.out.ext, { type: proj.out.type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try {
      await navigator.share({ files: [f], title: proj.name });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  download(b, f.name);
  toast('Wayarka ba ta goyi bayan aikawa kai tsaye. An sauke bidiyon, buɗe CapCut ko YouCut ka ɗauko shi.', 5000);
}

async function pickMusic(file) {
  if (!file || !proj) return;
  busy('Ana ƙara kiɗa...');
  try {
    const dur = await mediaDuration(file);
    if (!dur) throw new Error('x');
    const id = uid();
    await DB.put(id, file);
    const old = proj.music && proj.music.id;
    proj.music = { id, name: file.name.replace(/\.[^.]+$/, ''), dur };
    if (old) {
      if (P.musId === old) P.musId = null;
      await purgeBlobs([old]);
    }
    touch();
    await persist();
    renderTimeline();
    syncPanel();
    await P.prepMusic(P.t);
    toast('An ƙara kiɗa');
  } catch (e) {
    toast('Ba a iya ƙara wannan kiɗan ba');
  }
  unbusy();
}

async function deleteMusic() {
  if (!proj || !proj.music) return;
  const id = proj.music.id;
  proj.music = null;
  if (P.musId === id) P.musId = null;
  muEl.pause();
  muEl.removeAttribute('src');
  await purgeBlobs([id]);
  touch();
  renderTimeline();
  syncPanel();
}

async function pickLogo(file) {
  if (!file || !proj) return;
  if (!file.type.startsWith('image/')) return toast('Zaɓi hoto kawai');
  const id = uid();
  const old = proj.logo.custom;
  await DB.put(id, file);
  proj.logo.custom = id;
  if (old) await purgeBlobs([old]);
  await loadCustomLogo();
  touch();
  toast('An saka logonka');
}
async function resetLogo() {
  if (!proj) return;
  const old = proj.logo.custom;
  proj.logo.custom = null;
  custLogoOk = false;
  if (old) await purgeBlobs([old]);
  touch();
  P.render();
  toast('An dawo da logon asali');
}

async function addOverlays(files) {
  const s = curScene();
  if (!s) return toast('Zaɓi scene tukuna');
  busy('Ana ƙara...');
  let fail = 0;
  for (const f of Array.from(files)) {
    try {
      const m = await ingest(f);
      const ov = { id: uid(), type: m.type, mediaId: m.id, thumb: m.thumb, ar: m.w && m.h ? m.h / m.w : 1, x: 0.5, y: 0.35, w: 0.4, op: 1 };
      s.overlays.push(ov);
      selOv = ov.id;
    } catch (e) {
      fail++;
    }
  }
  unbusy();
  if (fail) toast(fail + ' ba a iya ƙara su ba');
  touch();
  await ensureOverlays(s);
  renderOv();
  renderTimeline();
  P.render();
}

async function deleteScene() {
  const s = curScene();
  if (!s) return;
  if (!confirm('A goge scene ' + (selIdx + 1) + '?')) return;
  P.pause();
  proj.scenes.splice(selIdx, 1);
  await purgeBlobs([s.voId]);
  if (P.voId === s.voId) P.voId = null;
  selIdx = proj.scenes.length ? clamp(selIdx, 0, proj.scenes.length - 1) : -1;
  selOv = null;
  P.idx = -1;
  touch();
  P.refresh();
  renderTimeline();
  syncPanel();
  if (proj.scenes.length) await P.seek(P.lay[selIdx].start + 0.01);
  else {
    P.t = 0;
    P.ui();
    P.render();
  }
}

async function deleteVoice() {
  const s = curScene();
  if (!s || !s.voId) return toast('Babu murya a wannan scene');
  const old = s.voId;
  s.voId = null;
  s.voDur = 0;
  s.voRate = 1;
  s.caps = null;
  if (P.voId === old) P.voId = null;
  voEl.pause();
  await purgeBlobs([old]);
  touch();
  await afterEdit();
  syncPanel();
}

async function splitScene() {
  const s = curScene();
  if (!s) return toast('Zaɓi scene tukuna');
  if (s.voId) return toast('Goge muryar scene tukuna kafin ka fasa ta');
  const L = P.lay[selIdx];
  const local = P.t - L.start;
  if (local < 0.3 || local > clipDur(s) - 0.3) return toast('Kawo layin lokaci cikin scene ɗin (akalla 0.3s daga gefe)');
  const b = JSON.parse(JSON.stringify(s));
  b.id = uid();
  b.text = '';
  b.caps = null;
  s.caps = null;
  b.overlays = [];
  b.trans = 'none';
  if (s.type === 'video') {
    const at = s.trimIn + local * s.speed;
    b.trimIn = at;
    s.trimOut = at;
  } else {
    b.dur = s.dur - local;
    s.dur = local;
  }
  proj.scenes.splice(selIdx + 1, 0, b);
  touch();
  P.idx = -1;
  P.refresh();
  renderTimeline();
  syncPanel();
  toast('An fasa scene gida biyu');
}

async function moveScene(dir) {
  const j = selIdx + dir;
  if (selIdx < 0 || j < 0 || j >= proj.scenes.length) return;
  const arr = proj.scenes;
  [arr[selIdx], arr[j]] = [arr[j], arr[selIdx]];
  selIdx = j;
  touch();
  P.idx = -1;
  P.refresh();
  renderTimeline();
  syncPanel();
  await P.seek(P.lay[selIdx].start + 0.01);
}

function bindSwitch(id, fn) {
  $(id).addEventListener('click', () => {
    const on = !$(id).classList.contains('on');
    setSwitch(id, on);
    fn(on);
  });
}

let drag = null;
function canvasPoint(e) {
  const cv = $('#cv');
  const r = cv.getBoundingClientRect();
  const sc = Math.min(r.width / cv.width, r.height / cv.height);
  const dw = cv.width * sc;
  const dh = cv.height * sc;
  const ox = r.left + (r.width - dw) / 2;
  const oy = r.top + (r.height - dh) / 2;
  return { x: (e.clientX - ox) / sc, y: (e.clientY - oy) / sc, W: cv.width, H: cv.height };
}
function hitTest(p) {
  const s = curScene();
  const inR = r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  if (proj.logo.on) {
    const r = logoRect(p.W, p.H);
    if (inR(r)) return { kind: 'logo', ox: proj.logo.nx * p.W - p.x, oy: proj.logo.ny * p.H - p.y };
  }
  if (s) {
    for (let i = s.overlays.length - 1; i >= 0; i--) {
      const o = s.overlays[i];
      if (inR(ovRect(o, p.W, p.H))) return { kind: 'ov', id: o.id, ox: o.x * p.W - p.x, oy: o.y * p.H - p.y };
    }
  }
  return null;
}

function setPanelTab(name) {
  $$('#tabs [data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
  $$('.pn').forEach(x => x.classList.toggle('on', x.dataset.panel === name));
  const b = $('#tabs [data-tab="' + name + '"]');
  $('#panelTitle').textContent = b ? b.textContent : '';
  $('#panel').classList.add('open');
}

function bind() {
  setupMicPicker();
  LANGS.forEach(([c, n]) => $('#selLang').insertAdjacentHTML('beforeend', '<option value="' + c + '">' + n + '</option>'));

  $$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal('#' + b.dataset.close)));

  $('#btnNew').onclick = () => {
    $('#newName').value = '';
    $('#newErr').classList.add('hidden');
    openModal('#mNew');
    setTimeout(() => $('#newName').focus(), 80);
  };
  $('#newCancel').onclick = () => closeModal('#mNew');
  const createNew = async () => {
    const name = $('#newName').value.trim();
    if (!name) {
      $('#newErr').classList.remove('hidden');
      $('#newName').focus();
      return;
    }
    closeModal('#mNew');
    const p = newProject(name);
    await openProject(p.id);
    openLibrary(null);
  };
  $('#newOk').onclick = createNew;
  $('#newName').addEventListener('keydown', e => {
    if (e.key === 'Enter') createNew();
  });
  $('#projList').addEventListener('click', e => {
    const d = e.target.closest('[data-del]');
    if (d) return deleteProject(d.dataset.del);
    const c = e.target.closest('.pcard');
    if (c) openProject(c.dataset.id);
  });

  $('#libBack').onclick = async () => {
    show(proj ? 'editor' : 'home');
    if (proj) {
      P.idx = -1;
      P.refresh();
      renderTimeline();
      syncPanel();
      if (proj.scenes.length) await P.seek(P.t);
    }
  };
  $('#pickAll').onclick = () => $('#fAll').click();
  $('#pickDir').onclick = () => $('#fDir').click();
  ['#fAll', '#fDir'].forEach(id => {
    $(id).addEventListener('change', e => {
      addPicked(e.target.files);
      e.target.value = '';
    });
  });
  $('#libGrid').addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]');
    if (rm) return removeMedia(rm.dataset.rm);
    const it = e.target.closest('.it');
    if (it) toggleReg(it.dataset.reg);
  });
  $('#trayItems').addEventListener('click', e => {
    const t = e.target.closest('.ti');
    if (!t) return;
    lib.sel = lib.sel.filter(x => x.id !== t.dataset.id);
    refreshBadges();
    renderTray(true);
  });
  $('#trayClear').onclick = () => {
    lib.sel = [];
    refreshBadges();
    renderTray();
  };
  $('#btnAdd').onclick = addSelected;

  $('#edBack').onclick = closeEditor;
  $('#edName').addEventListener('input', e => {
    const v = e.target.value.trim();
    if (v && proj) {
      proj.name = v;
      touch();
    }
  });
  $('#emptyAdd').onclick = () => openLibrary(null);
  $('#btnPlay').onclick = () => {
    if (P.playing) P.pause();
    else P.play();
  };
  $('#btnStageFull').onclick = () => {
    const st = $('#stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (st.requestFullscreen) st.requestFullscreen().catch(() => {});
  };
  const sc = $('#scrub');
  sc.addEventListener('pointerdown', () => (P.scrubbing = true));
  sc.addEventListener('input', () => P.seek(sc.value / 1000 * P.total));
  const endScrub = () => {
    P.scrubbing = false;
    persistSoon();
  };
  sc.addEventListener('pointerup', endScrub);
  sc.addEventListener('change', endScrub);
  $('#tlInner').addEventListener('click', e => {
    if (e.target.closest('#tlAdd')) return openLibrary(null);
    if (e.target.closest('#tlAddStart')) return openLibrary(0);
    const c = e.target.closest('.card');
    if (c) selectScene(parseInt(c.dataset.i, 10), true);
  });

  const cv = $('#cv');
  cv.addEventListener('pointerdown', e => {
    if (!proj || P.playing || P.exporting) return;
    const hit = hitTest(canvasPoint(e));
    if (!hit) return;
    drag = hit;
    if (hit.kind === 'ov') {
      selOv = hit.id;
      renderOv();
    }
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (err) {}
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = canvasPoint(e);
    const nx = clamp((p.x + drag.ox) / p.W, 0, 1);
    const ny = clamp((p.y + drag.oy) / p.H, 0, 1);
    if (drag.kind === 'logo') {
      proj.logo.nx = nx;
      proj.logo.ny = ny;
    } else {
      const o = selOvObj();
      if (o) {
        o.x = nx;
        o.y = ny;
      }
    }
    P.render();
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    touch();
    P.render();
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    const same = b.classList.contains('on') && $('#panel').classList.contains('open');
    if (same && window.innerWidth < 900) {
      $('#panel').classList.remove('open');
      $$('#tabs [data-tab]').forEach(x => x.classList.remove('on'));
      return;
    }
    setPanelTab(b.dataset.tab);
  });
  $('#panelClose').onclick = () => {
    $('#panel').classList.remove('open');
    $$('#tabs [data-tab]').forEach(x => x.classList.remove('on'));
  };
  ['voice', 'text', 'edit', 'layers', 'style'].forEach(n => $('.pn[data-panel="' + n + '"]').classList.add('scene-only'));

  $('#btnRec').onclick = recordFlow;
  $('#recCancel').onclick = () => {
    Rec.cancel = true;
  };
  $('#recX').onclick = () => {
    Rec.cancel = true;
    if (Rec.abort) Rec.abort();
  };
  $('#revSave').onclick = saveVoice;
  const dropRev = () => {
    Rec.pending = null;
    $('#revAudio').pause();
    closeModal('#mReview');
  };
  $('#revDrop').onclick = dropRev;
  $('#revX').onclick = dropRev;
  $('#revRedo').onclick = () => {
    dropRev();
    recordFlow();
  };
  bindSwitch('#swAutoCap', on => {
    settings.autoCap = on;
    saveJSON(KEY_SET, settings);
  });
  $('#micGain').addEventListener('input', e => {
    settings.micGain = parseFloat(e.target.value);
    $('#micGainV').textContent = settings.micGain + 'x';
    saveJSON(KEY_SET, settings);
  });
  $('#selNr').addEventListener('change', e => {
    settings.nr = e.target.value;
    saveJSON(KEY_SET, settings);
  });
  $('#selLang').addEventListener('change', e => {
    settings.lang = e.target.value;
    saveJSON(KEY_SET, settings);
  });
  $('#capSrc').addEventListener('change', e => {
    settings.capSrc = e.target.value;
    saveJSON(KEY_SET, settings);
  });
  $('#voVol').addEventListener('input', e => {
    if (!proj) return;
    proj.aud.voVol = e.target.value / 100;
    $('#voVolV').textContent = e.target.value + '%';
    P.applyGains();
    touch();
  });
  $('#origVol').addEventListener('input', e => {
    if (!proj) return;
    proj.aud.origVol = e.target.value / 100;
    $('#origVolV').textContent = e.target.value + '%';
    P.applyGains();
    touch();
  });
  bindSwitch('#swOrig', on => {
    if (!proj) return;
    proj.aud.autoMute = on;
    P.applyGains();
    touch();
  });
  $('#btnVoBoost').onclick = () => boostVoice(false);
  $('#btnVoBoostAll').onclick = () => boostVoice(true);
  $('#selCapAnim').addEventListener('change', e => {
    if (!proj) return;
    proj.capAnim = e.target.value;
    touch();
    P.render();
  });
  $('#selAsr').addEventListener('change', e => {
    settings.asrModel = e.target.value;
    saveJSON(KEY_SET, settings);
  });
  $('#btnVoPlay').onclick = async () => {
    const s = curScene();
    if (!s || !s.voId) return toast('Babu murya a wannan scene');
    const u = await urlFor(s.voId);
    if (!u) return;
    P.pause();
    const a = new Audio(u);
    a.volume = 1;
    a.play().catch(() => {});
  };
  $('#btnVoDel').onclick = deleteVoice;
  $('#voCutIn').addEventListener('input', e => {
    const o = $('#voCutOut');
    if (parseFloat(e.target.value) > parseFloat(o.value) - 0.2) e.target.value = Math.max(0, parseFloat(o.value) - 0.2);
    $('#voCutInV').textContent = fmt1(parseFloat(e.target.value));
  });
  $('#voCutOut').addEventListener('input', e => {
    const i = $('#voCutIn');
    if (parseFloat(e.target.value) < parseFloat(i.value) + 0.2) e.target.value = parseFloat(i.value) + 0.2;
    $('#voCutOutV').textContent = fmt1(parseFloat(e.target.value));
  });
  $('#btnVoCut').onclick = voiceCut;
  $('#btnVoClean').onclick = voiceClean;

  $('#capText').addEventListener('input', e => {
    const s = curScene();
    if (!s) return;
    const had = hasCaps();
    s.text = e.target.value;
    touch();
    if (had !== hasCaps()) renderTimeline();
    P.render();
  });
  $('#btnCapClear').onclick = () => {
    const s = curScene();
    if (!s) return;
    s.text = '';
    s.caps = null;
    $('#capText').value = '';
    touch();
    renderTimeline();
    P.render();
  };
  $('#btnAutoCap').onclick = () => (selIdx >= 0 ? transcribeScene(selIdx, $('#capSrc').value) : toast('Zaɓi scene tukuna'));

  const trimChange = () => {
    const s = curScene();
    if (!s || s.type !== 'video') return;
    let a = parseFloat($('#trimIn').value);
    let b = parseFloat($('#trimOut').value);
    if (b - a < 0.3) {
      if (document.activeElement === $('#trimIn')) a = Math.max(0, b - 0.3);
      else b = Math.min(s.srcDur, a + 0.3);
      $('#trimIn').value = a;
      $('#trimOut').value = b;
    }
    s.trimIn = a;
    s.trimOut = b;
    $('#trimInV').textContent = fmt1(a);
    $('#trimOutV').textContent = fmt1(b);
    touch();
    afterEdit();
  };
  $('#trimIn').addEventListener('input', trimChange);
  $('#trimOut').addEventListener('input', trimChange);
  $('#selSpeed').addEventListener('change', e => {
    const s = curScene();
    if (!s) return;
    s.speed = parseFloat(e.target.value);
    touch();
    afterEdit();
  });
  $('#imgDur').addEventListener('input', e => {
    const s = curScene();
    if (!s) return;
    s.dur = parseFloat(e.target.value);
    $('#imgDurV').textContent = fmt1(s.dur);
    touch();
    afterEdit(false);
  });
  $('#btnFit').onclick = () => {
    const s = curScene();
    if (!s) return;
    if (!s.voId) return toast('Ka yi rikodin murya tukuna a wannan scene');
    fitToVoice(false);
    touch();
    afterEdit();
    syncPanel();
  };
  $('#btnSplit').onclick = splitScene;
  $('#btnAddBefore').onclick = () => selIdx >= 0 && openLibrary(selIdx);
  $('#btnAddAfter').onclick = () => selIdx >= 0 && openLibrary(selIdx + 1);
  $('#btnLeft').onclick = () => moveScene(-1);
  $('#btnRight').onclick = () => moveScene(1);
  $('#btnDelScene').onclick = deleteScene;

  $('#btnOvImg').onclick = () => $('#fOvImg').click();
  $('#btnOvVid').onclick = () => $('#fOvVid').click();
  ['#fOvImg', '#fOvVid'].forEach(id => {
    $(id).addEventListener('change', e => {
      const f = Array.from(e.target.files);
      e.target.value = '';
      if (f.length) addOverlays(f);
    });
  });
  $('#ovList').addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const s = curScene();
      if (!s) return;
      s.overlays = s.overlays.filter(o => o.id !== rm.dataset.rm);
      ensureOverlays(s);
      touch();
      renderOv();
      renderTimeline();
      P.render();
      return;
    }
    const it = e.target.closest('.ovi');
    if (it) {
      selOv = it.dataset.id;
      renderOv();
      P.render();
    }
  });
  $('#ovSize').addEventListener('input', e => {
    const o = selOvObj();
    if (!o) return;
    o.w = e.target.value / 100;
    $('#ovSizeV').textContent = e.target.value + '%';
    touch();
    P.render();
  });
  $('#ovOp').addEventListener('input', e => {
    const o = selOvObj();
    if (!o) return;
    o.op = e.target.value / 100;
    $('#ovOpV').textContent = e.target.value + '%';
    touch();
    P.render();
  });
  $('#btnOvCenter').onclick = () => {
    const o = selOvObj();
    if (!o) return;
    o.x = 0.5;
    o.y = 0.4;
    touch();
    P.render();
  };
  $('#btnOvDel').onclick = () => {
    const o = selOvObj();
    if (o) $('#ovList').querySelector('[data-rm="' + o.id + '"]').click();
  };

  $('#selTrans').addEventListener('change', e => {
    const s = curScene();
    if (!s) return;
    s.trans = e.target.value;
    touch();
    if (P.lay[selIdx]) P.seek(P.lay[selIdx].start + 0.2);
  });
  bindSwitch('#swMotion', on => {
    const s = curScene();
    if (!s) return;
    s.motion = on;
    touch();
    P.render();
  });
  $('#btnTransAll').onclick = () => {
    const s = curScene();
    if (!s) return;
    proj.scenes.forEach(x => {
      x.trans = s.trans;
      x.motion = s.motion;
    });
    touch();
    toast('An saka salon a duka scenes');
  };
  $('#selFit').addEventListener('change', e => {
    proj.fitMode = e.target.value;
    touch();
    P.render();
  });

  $('#btnMusic').onclick = () => $('#fAud').click();
  $('#fAud').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    pickMusic(f);
  });
  $('#musVol').addEventListener('input', e => {
    proj.musicVol = e.target.value / 100;
    $('#musVolV').textContent = e.target.value + '%';
    touch();
  });
  bindSwitch('#swDuck', on => {
    proj.duck = on;
    touch();
  });
  $('#btnMusDel').onclick = deleteMusic;

  bindSwitch('#swLogoOn', on => {
    proj.logo.on = on;
    touch();
    P.render();
  });
  bindSwitch('#swLogoAnim', on => {
    proj.logo.anim = on;
    touch();
    P.render();
  });
  $('#logoSize').addEventListener('input', e => {
    proj.logo.size = e.target.value / 100;
    $('#logoSizeV').textContent = e.target.value + '%';
    touch();
    P.render();
  });
  $('#btnLogoPick').onclick = () => $('#fLogo').click();
  $('#fLogo').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    pickLogo(f);
  });
  $('#btnLogoReset').onclick = resetLogo;
  $('#btnLogoPos').onclick = () => {
    proj.logo.nx = 0.905;
    proj.logo.ny = 0.085;
    touch();
    P.render();
  };
  bindSwitch('#swLogo', on => {
    proj.logo.center = on;
    touch();
    P.render();
  });
  $('#logoOp').addEventListener('input', e => {
    proj.logo.opacity = e.target.value / 100;
    $('#logoOpV').textContent = e.target.value + '%';
    touch();
    P.render();
  });

  $('#selAspect').addEventListener('change', e => {
    proj.aspect = e.target.value;
    touch();
    P.render();
  });
  $('#selRes').addEventListener('change', e => {
    proj.res = parseInt(e.target.value, 10);
    touch();
  });
  $('#btnExport').onclick = () => setPanelTab('export');
  $('#btnMake').onclick = exportVideo;
  $('#btnSaveDev').onclick = saveDevice;
  $('#btnShareCC').onclick = shareToApps;
  $('#btnOpenOut').onclick = showResult;
  $('#resSave').onclick = saveDevice;
  $('#resShare').onclick = shareToApps;
  $('#resFull').onclick = () => {
    const v = $('#resVid');
    if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  };
  $('#resOpen').onclick = () => {
    if (resUrl) window.open(resUrl, '_blank');
  };
  $('#mResult').querySelector('[data-close]').addEventListener('click', () => $('#resVid').pause());
  $('#busyCancel').onclick = cancelExport;
  $('#busyX').onclick = cancelExport;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && proj) {
      if (P.playing && !P.exporting && !P.recMode && !P.stt) P.pause();
      persist();
    }
  });
  window.addEventListener('pagehide', () => {
    if (proj) persist();
  });

  const net = () => {
    const on = navigator.onLine;
    const n = $('#net');
    n.classList.toggle('on', on);
    n.innerHTML = on ? '<i class="fa-solid fa-wifi"></i><em>Online</em>' : '<i class="fa-solid fa-plane"></i><em>Offline</em>';
  };
  window.addEventListener('online', () => {
    net();
    toast('Intanet ya dawo');
    loadLogo();
  });
  window.addEventListener('offline', () => {
    net();
    toast('Babu intanet. Komai yana aiki kamar yadda yake.');
  });
  net();

  let deferred = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone()) $('#btnInstall').classList.add('hidden');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
  });
  $('#btnInstall').onclick = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
    } else openModal('#mInstall');
  };
  window.addEventListener('appinstalled', () => $('#btnInstall').classList.add('hidden'));
}

async function offlineStatus() {
  try {
    const keys = await caches.keys();
    let n = 0;
    for (const k of keys) n += (await (await caches.open(k)).keys()).length;
    $('#offState').innerHTML = n >= 4 ? '<i class="fa-solid fa-circle-check"></i> Yana aiki ba tare da intanet ba' : '';
  } catch (e) {}
}

async function init() {
  try {
    let pj = await DB.get('meta:projects');
    if (!pj) pj = loadJSON(KEY_OLD, []);
    projects = (Array.isArray(pj) ? pj : []).map(normalizeProject);
    media = (await DB.get('meta:media')) || [];
  } catch (e) {
    projects = [];
    media = [];
  }
  bind();
  renderHome();
  loadLogo();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => {
      if (!localStorage.getItem(KEY_SW)) {
        localStorage.setItem(KEY_SW, '1');
        toast('An saukar da app. Yanzu yana aiki ba tare da intanet ba.', 4200);
      }
      setTimeout(offlineStatus, 1500);
    }).catch(() => {});
  }
  if (window.innerWidth >= 900) setPanelTab('voice');
  const last = localStorage.getItem(KEY_LAST);
  if (last && projects.some(p => p.id === last)) await openProject(last);
}

window.addEventListener('unhandledrejection', e => {
  if (e && e.reason && e.reason.message === 'cancel') return;
  toast('Wani abu bai yi daidai ba, an ci gaba. Sake gwadawa.');
});
window.addEventListener('error', () => {
  toast('Wani abu bai yi daidai ba, an ci gaba. Sake gwadawa.');
});

init();
