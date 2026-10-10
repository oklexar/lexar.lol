// Visitor details are collected only after the visitor explicitly opts in.

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
    connection: connection
      ? `${readable(connection.effectiveType)} / ${readable(connection.downlink)} Mbps`
      : 'unavailable',
    touch_points: readable(nav.maxTouchPoints),
    cpu_threads: readable(nav.hardwareConcurrency),
    device_memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'unavailable',
  };
}

async function sendToWorker(facts) {
  const message = Object.entries(facts)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')
    .slice(0, 1800);
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error(`Worker request failed (${response.status})`);
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

function createConsentPanel() {
  const panel = document.createElement('section');
  panel.className = 'consent-panel';
  panel.setAttribute('aria-labelledby', 'visitor-details-consent-title');
  const title = document.createElement('h2');
  title.id = 'visitor-details-consent-title';
  title.textContent = 'Share visitor details?';
  const explanation = document.createElement('p');
  explanation.textContent =
    'If you allow it, this page will collect browser, device, and approximate network details, including your public IP address, and send them to the site owner through Discord. The IP lookup is provided by ipwho.is. Choose “Continue without sharing” to use the page without collecting or sending these details.';
  const actions = document.createElement('div');
  actions.className = 'consent-panel__actions';
  const allowButton = document.createElement('button');
  allowButton.type = 'button';
  allowButton.textContent = 'Allow and continue';
  const declineButton = document.createElement('button');
  declineButton.type = 'button';
  declineButton.textContent = 'Continue without sharing';
  actions.append(allowButton, declineButton);
  panel.append(title, explanation, actions);
  output.before(panel);
  return { panel, allowButton, declineButton };
}

async function run(shareDetails) {
  output.replaceChildren();
  welcome.hidden = true;
  continueButton.hidden = true;

  if (!shareDetails) {
    await typeLine('privacy', 'No browser or network details were collected or sent.', 5);
  } else {
    await typeLine('status', 'Collecting the details you agreed to share...', 12);
    const facts = {
      ...browserDetails(),
      'public ip': 'loading',
    };
    const remote = await networkDetails();
    facts['public ip'] = remote.ip;
    facts['approx. network location'] = remote.network;
    facts['network timezone'] = remote.timezone;
    facts['network provider'] = remote.org;

    for (const [label, value] of Object.entries(facts)) {
      await typeLine(label.replaceAll('_', ' '), value, 5);
    }
    try {
      await sendToWorker(facts);
      await typeLine('delivery', 'Details sent to the site owner.', 5);
    } catch {
      await typeLine('delivery', 'Could not send details. The page can still continue.', 5);
    }
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

welcome.hidden = true;
continueButton.hidden = true;
const consent = createConsentPanel();
consent.allowButton.addEventListener('click', () => {
  consent.panel.remove();
  void run(true);
}, { once: true });
consent.declineButton.addEventListener('click', () => {
  consent.panel.remove();
  void run(false);
}, { once: true });
