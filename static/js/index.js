document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    setupFluxAnimations();
    setupTestLogic();
    fetchSystemInfo();
});

// ── Constants matching app.py ─────────────────────────────────────────
const DOWNLOAD_SIZE_MB = 50;
const UPLOAD_SIZE_MB   = 25;
const MAX_SPEED_MBPS   = 5000;

// ── Server info ───────────────────────────────────────────────────────
async function fetchSystemInfo() {
    try {
        const t0  = performance.now();
        const res = await fetch('/ping', { cache: 'no-store' });
        const rtt = performance.now() - t0;
        const data = await res.json();
        const health = await fetch('/health', { cache: 'no-store' }).then(r => r.json());
        const healthSt = document.getElementById('server-indicator');

        const name = data.server || 'Server';
        document.getElementById('ping-value').textContent = rtt.toFixed(0);
        document.getElementById('server-name').textContent     = name;
        document.getElementById('server-health').textContent   = health.status || 'Unknown';
        document.getElementById('server-health').classList.remove('text-red-500');
        document.getElementById('server-health').classList.add('text-green-500');
        if (healthSt) {
            healthSt.classList.remove('bg-red-500');
            healthSt.classList.add('bg-green-500');
        }
    } catch (e) {
        console.error('fetchSystemInfo:', e);
        document.getElementById('server-name').textContent = 'unreachable';
        const healthEl = document.getElementById('server-health');
        const healthSt = document.getElementById('server-indicator');
        healthEl.textContent = 'Server Unreachable';
        healthEl.classList.remove('text-green-500');
        healthEl.classList.add('text-red-500');
        if (healthSt) {
            healthSt.classList.remove('bg-green-500');
            healthSt.classList.add('bg-red-500');
        }
    }
}

// ── Particles ─────────────────────────────────────────────────────────
function initParticles() {
    const container = document.getElementById('particles');
    const colors = ['#06b6d4', '#6366f1', '#8b5cf6'];

    function createParticle() {
        const p = document.createElement('div');
        p.className = 'flux-particle';
        p.style.left   = `${Math.random() * 100}%`;
        p.style.top    = `${Math.random() * 100}%`;
        const size     = Math.random() * 4 + 1;
        const duration = Math.random() * 8 + 8;
        p.style.width      = `${size}px`;
        p.style.height     = `${size}px`;
        p.style.opacity    = String(0.1 + Math.random() * 0.3);
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.boxShadow  = `0 0 ${size}px rgba(99,102,241,0.3)`;
        p.style.animation  = `pulse ${duration}s ease-in-out infinite, flow ${Math.random() * 5 + 3}s linear infinite`;
        p.style.animationDelay = `${Math.random() * 2}s`;
        container.appendChild(p);
        setTimeout(() => p.remove(), duration * 1000 + 1000);
    }

    for (let i = 0; i < 20; i++) setTimeout(createParticle, i * 150);
    setInterval(createParticle, 600);
}

// ── Background animations ─────────────────────────────────────────────
function setupFluxAnimations() {
    const dlBg  = document.getElementById('dl-bg-gradient');
    const ulBg  = document.getElementById('ul-bg-gradient');
    const dlGlow = document.getElementById('dl-glow');
    const ulGlow = document.getElementById('ul-glow');

    setInterval(() => {
        if (dlBg)  dlBg.style.backgroundPosition  = `${Math.random()*100}% ${Math.random()*100}%`;
        if (ulBg)  ulBg.style.backgroundPosition  = `${Math.random()*100}% ${Math.random()*100}%`;
        [dlGlow, ulGlow].forEach(g => { if (g) g.style.opacity = String(Math.random() * 0.2 + 0.1); });
    }, 3000);
}

// ── UI helpers ────────────────────────────────────────────────────────
function setStatus(message, color) {
    const label = document.getElementById('btn-label');
    const colorMap = { green:'#22c55e', red:'#ef4444', purple:'#a855f7', cyan:'#06b6d4', white:'#ffffff' };
    label.textContent = message;
    label.style.color = colorMap[color] || '#ffffff';
}

function setCircle(circleId, pct) {
    // stroke-dasharray=276.5 -> 0 = full, 276.5 = empty
    const offset = 276.5 * (1 - Math.min(pct, 1));
    document.getElementById(circleId).style.strokeDashoffset = String(offset);
}

function fmtTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function resetCard(prefix) {
    document.getElementById(`${prefix}-speed`).textContent = '0';
    document.getElementById(`${prefix}-timer`).textContent = '00:00';
    document.getElementById(`${prefix}-bytes`).textContent = '0 MB';
    setCircle(`${prefix}-circle`, 0);
}

function disableButtons(disabled) {
    const btn = document.getElementById('start-all-btn');
    btn.disabled = disabled;
    btn.querySelector('#btn-label').textContent = disabled ? 'Testing…' : 'Start Full Speed Test';
    btn.querySelector('#btn-label').style.color = '';
    btn.querySelector('#btn-icon').style.display = disabled ? 'none' : '';
}

function triggerCompletionEffect() {
    const overlay = document.getElementById('completion-overlay');
    const statusBar = document.getElementById('status-bar');
    const cards = [document.getElementById('dl-card'), document.getElementById('ul-card')];

    overlay.classList.remove('active');
    void overlay.offsetWidth;
    overlay.classList.add('active');

    statusBar.classList.add('active');
    cards.forEach((card) => {
        if (!card) return;
        card.classList.add('complete-glow');
    });

    window.setTimeout(() => {
        overlay.classList.remove('active');
        statusBar.classList.remove('active');
    }, 1500);
}

// ── Latency measurement ───────────────────────────────────────────────
async function measureLatency(count = 5) {
    const times = [];
    for (let i = 0; i < count; i++) {
        const t0  = performance.now();
        const res = await fetch('/ping', { cache: 'no-store' });
        if (!res.ok) throw new Error('Ping failed');
        await res.json();
        times.push(performance.now() - t0);
    }
    return times.reduce((a, b) => a + b, 0) / times.length;
}

// ── Download test ─────────────────────────────────────────────────────
async function runDownloadTest() {
    resetCard('dl');
    setStatus('Testing download…', 'cyan');

    const startTime = performance.now();
    let received = 0;
    let timerHandle;

    // Update timer every second
    timerHandle = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        document.getElementById('dl-timer').textContent = fmtTime(elapsed);
    }, 1000);

    try {
        const response = await fetch('/download', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const totalBytes = DOWNLOAD_SIZE_MB * 1024 * 1024;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.length;

            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > 0.1) {
                const speedMbps = (received * 8) / (elapsed * 1024 * 1024);
                document.getElementById('dl-speed').textContent = speedMbps.toFixed(1);
                document.getElementById('dl-bytes').textContent = (received / 1024 / 1024).toFixed(1) + ' MB';
                setCircle('dl-circle', received / totalBytes);
            }
        }

        const totalSec  = (performance.now() - startTime) / 1000;
        const finalMbps = totalSec > 0 ? (received * 8) / (totalSec * 1024 * 1024) : 0;

        document.getElementById('dl-speed').textContent = finalMbps.toFixed(1);
        document.getElementById('dl-bytes').textContent = (received / 1024 / 1024).toFixed(1) + ' MB';
        document.getElementById('dl-timer').textContent = fmtTime(totalSec);
        setCircle('dl-circle', 1);
        setStatus('Download complete!', 'green');
        return finalMbps;

    } finally {
        clearInterval(timerHandle);
    }
}

// ── Upload test ───────────────────────────────────────────────────────
// Uses XMLHttpRequest instead of fetch because fetch() offers no
// upload.onprogress events - bytes-sent is unknowable until the request
// completes, causing the speed display to stay at 0 the whole time.
function runUploadTest() {
    resetCard('ul');
    setStatus('Testing upload…', 'purple');

    // Build buffer with crypto.getRandomValues (fast, ~ms for 50 MB)
    const sizeBytes = UPLOAD_SIZE_MB * 1024 * 1024;
    const buffer    = new Uint8Array(sizeBytes);
    const CHUNK     = 65536;
    for (let offset = 0; offset < sizeBytes; offset += CHUNK) {
        crypto.getRandomValues(buffer.subarray(offset, Math.min(offset + CHUNK, sizeBytes)));
    }

    return new Promise((resolve, reject) => {
        const xhr       = new XMLHttpRequest();
        const startTime = performance.now();

        // Timer - updates elapsed time every second
        const timerHandle = setInterval(() => {
            const elapsed = (performance.now() - startTime) / 1000;
            document.getElementById('ul-timer').textContent = fmtTime(elapsed);
        }, 1000);

        // Real-time progress from the browser's upload stream
        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const elapsed  = (performance.now() - startTime) / 1000;
            const pct      = event.loaded / event.total;
            const speedMbps = elapsed > 0
                ? (event.loaded * 8) / (elapsed * 1024 * 1024)
                : 0;

            document.getElementById('ul-speed').textContent =
                speedMbps.toFixed(1);
            document.getElementById('ul-bytes').textContent =
                (event.loaded / 1024 / 1024).toFixed(1) + ' MB';
            setCircle('ul-circle', pct);
        };

        xhr.onload = () => {
            clearInterval(timerHandle);
            if (xhr.status >= 200 && xhr.status < 300) {
                const totalSec  = (performance.now() - startTime) / 1000;
                const finalMbps = totalSec > 0
                    ? (sizeBytes * 8) / (totalSec * 1024 * 1024)
                    : 0;
                document.getElementById('ul-speed').textContent = finalMbps.toFixed(1);
                document.getElementById('ul-bytes').textContent = UPLOAD_SIZE_MB + ' MB';
                document.getElementById('ul-timer').textContent = fmtTime(totalSec);
                setCircle('ul-circle', 1);
                setStatus('Upload complete!', 'green');
                resolve(finalMbps);
            } else {
                let msg = `HTTP ${xhr.status}`;
                try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
                reject(new Error(msg));
            }
        };

        xhr.onerror   = () => { clearInterval(timerHandle); reject(new Error('Upload request failed')); };
        xhr.ontimeout = () => { clearInterval(timerHandle); reject(new Error('Upload timed out')); };

        xhr.open('POST', '/upload');
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(buffer);
    });
}

// ── Test orchestration ────────────────────────────────────────────────
function setupTestLogic() {
    let isTesting = false;

    async function run(dlOnly, ulOnly) {
        if (isTesting) return;
        isTesting = true;
        disableButtons(true);
        [document.getElementById('dl-card'), document.getElementById('ul-card')].forEach((card) => {
            if (card) card.classList.remove('complete-glow');
        });

        let dlSpeed = 0, ulSpeed = 0, latencyMs = null;

        try {
            // Always measure latency first
            setStatus('Measuring latency…', 'cyan');
            latencyMs = await measureLatency();
            document.getElementById('ping-value').textContent = latencyMs.toFixed(0);

            if (!ulOnly) dlSpeed = await runDownloadTest();
            if (!dlOnly) ulSpeed = await runUploadTest();

            setStatus('Test complete', 'green');
            triggerCompletionEffect();

        } catch (e) {
            setStatus(`Error: ${e.message}`, 'red');
            console.error(e);
        } finally {
            isTesting = false;
            disableButtons(false);
        }
    }

    document.getElementById('start-all-btn').addEventListener('click', () => run(false, false));
}
