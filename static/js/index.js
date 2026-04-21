document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    setupFluxAnimations();
    setupTestLogic();
    fetchSystemInfo();
});

// ── Constants matching app.py ─────────────────────────────────────────
const TEST_DURATION_SECONDS = 15;
const MAX_SPEED_MBPS        = 5000;

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
        document.getElementById('download-size').textContent = `Random bytes for ${TEST_DURATION_SECONDS}s`;
        document.getElementById('upload-size').textContent   = `Random bytes for ${TEST_DURATION_SECONDS}s`;
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
    const icon = document.getElementById('btn-icon');
    const colorMap = { green:'#22c55e', orange:'#f9ad16', red:'#ef4444', purple:'#a855f7', cyan:'#06b6d4', white:'#ffffff' };
    label.textContent = message;
    label.style.color = colorMap[color] || '#ffffff';
    icon.style.color = colorMap[color] || '#ffffff';
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
    btn.querySelector('#btn-icon').style.animation = disabled ? 'spin 1s linear infinite' : '';
    btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    btn.querySelector('#btn-icon').style.color = disabled ? '' : '#22c55e';
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
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + (t - avg) ** 2, 0) / times.length;
    const jitter = Math.sqrt(variance);
    return { avg, jitter };
}

// ── Download test ─────────────────────────────────────────────────────
async function runDownloadTest() {
    resetCard('dl');
    setStatus('Testing download…', 'cyan');

    const startTime = performance.now();
    let received    = 0;         // written only by the read loop
    let testDone    = false;     // set true when the 15 s window closes
    let rafHandle   = null;

    // ── rAF render loop ───────────────────────────────────────────────
    // Owns ALL DOM writes for speed/bytes/ring/timer.  Runs at the
    // display's native frame rate so the ring animates smoothly even on
    // high-refresh screens.  The read loop is pure data accumulation and
    // never touches the DOM directly.
    function rafLoop() {
        const elapsed = Math.min((performance.now() - startTime) / 1000, TEST_DURATION_SECONDS);
        document.getElementById('dl-timer').textContent = fmtTime(elapsed);

        if (!testDone && elapsed > 0.1) {
            const speedMbps = (received * 8) / (elapsed * 1024 * 1024);
            document.getElementById('dl-speed').textContent = speedMbps.toFixed(1);
            document.getElementById('dl-bytes').textContent = (received / 1024 / 1024).toFixed(1) + ' MB';
            setCircle('dl-circle', elapsed / TEST_DURATION_SECONDS);
        }

        if (!testDone) {
            rafHandle = requestAnimationFrame(rafLoop);
        }
    }
    rafHandle = requestAnimationFrame(rafLoop);

    try {
        const response = await fetch('/download', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();

        // Pure accumulation loop — no DOM writes here.
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.length;

            // Client-side cutoff: cancel any buffered data once the window expires.
            if ((performance.now() - startTime) / 1000 >= TEST_DURATION_SECONDS) {
                reader.cancel();
                break;
            }
        }

        // Freeze the rAF loop before writing final values so the last rAF
        // frame and the synchronous final write cannot race.
        testDone = true;
        if (rafHandle !== null) {
            cancelAnimationFrame(rafHandle);
            rafHandle = null;
        }

        // Speed uses the fixed test window as denominator, not total elapsed,
        // so server response latency cannot artificially deflate the result.
        const finalMbps = (received * 8) / (TEST_DURATION_SECONDS * 1024 * 1024);

        document.getElementById('dl-speed').textContent = finalMbps.toFixed(1);
        document.getElementById('dl-bytes').textContent = (received / 1024 / 1024).toFixed(1) + ' MB';
        document.getElementById('dl-timer').textContent = fmtTime(TEST_DURATION_SECONDS);
        setCircle('dl-circle', 1);
        setStatus('Download complete!', 'green');
        return finalMbps;

    } catch (err) {
        testDone = true;
        if (rafHandle !== null) { cancelAnimationFrame(rafHandle); rafHandle = null; }
        throw err;
    }
}

// ── Upload test ───────────────────────────────────────────────────────
// Uses fetch + ReadableStream so the upload runs for exactly TEST_DURATION_SECONDS,
// then the stream closes and the server returns the final result.
function runUploadTest() {
    resetCard('ul');
    setStatus('Testing upload…', 'purple');
    const uploadDelayHint = document.getElementById('upload-delay-hint');
    if (uploadDelayHint) {
        uploadDelayHint.textContent = '';
        uploadDelayHint.style.opacity = '0';
    }

    const startTime      = performance.now();
    let sentBytes        = 0;
    let streamClosed     = false;
    let finalizingShown  = false;
    let delayedHintTimer = null;

    // ReadableStream generates 64 KB random chunks until TEST_DURATION_SECONDS elapses,
    // then closes — the browser sends each chunk as it is produced.
    const stream = new ReadableStream({
        pull(controller) {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed >= TEST_DURATION_SECONDS) {
                streamClosed = true;
                controller.close();
                return;
            }
            const chunk = new Uint8Array(65536);
            crypto.getRandomValues(chunk);
            sentBytes += chunk.byteLength;
            controller.enqueue(chunk);
        }
    });

    const clearDelayedHint = () => {
        if (delayedHintTimer) { clearTimeout(delayedHintTimer); delayedHintTimer = null; }
        if (uploadDelayHint)  { uploadDelayHint.style.opacity = '0'; uploadDelayHint.textContent = ''; }
    };

    // Update UI at 200 ms intervals; also triggers the finalizing hint once the stream closes.
    const timerHandle = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        document.getElementById('ul-timer').textContent = fmtTime(elapsed);

        // Once the stream has closed (15 s elapsed), sentBytes is frozen.
        // Stop recalculating speed so it doesn't deflate as wait time grows.
        if (!streamClosed) {
            const speedMbps = elapsed > 0 ? (sentBytes * 8) / (elapsed * 1024 * 1024) : 0;
            document.getElementById('ul-speed').textContent = speedMbps.toFixed(1);
            document.getElementById('ul-bytes').textContent = (sentBytes / 1024 / 1024).toFixed(1) + ' MB';
            setCircle('ul-circle', Math.min(elapsed / TEST_DURATION_SECONDS, 1));
        }

        // Over tunnels/proxies, bytes can reach the edge before the origin reply arrives.
        // Show an explicit finalizing phase so the UI doesn’t appear stuck.
        if (streamClosed && !finalizingShown) {
            finalizingShown = true;
            setStatus('Upload complete. Finalizing on server…', 'orange');
            delayedHintTimer = window.setTimeout(() => {
                if (uploadDelayHint) {
                    uploadDelayHint.textContent = 'Network tunnel or proxy may add extra delay before confirmation.';
                    uploadDelayHint.style.opacity = '1';
                }
            }, 5000);
        }
    }, 200);

    return fetch('/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: stream,
        duplex: 'half',   // Required by Chrome 105+ for streaming request bodies
        cache: 'no-store',
    }).then(res => {
        clearInterval(timerHandle);
        clearDelayedHint();
        if (!res.ok) {
            return res.json().then(j => { throw new Error(j.error || `HTTP ${res.status}`); });
        }
        // Speed uses the fixed test window as denominator so the server
        // response wait time cannot artificially deflate the result.
        const finalMbps = (sentBytes * 8) / (TEST_DURATION_SECONDS * 1024 * 1024);
        document.getElementById('ul-speed').textContent = finalMbps.toFixed(1);
        document.getElementById('ul-bytes').textContent = (sentBytes / 1024 / 1024).toFixed(1) + ' MB';
        document.getElementById('ul-timer').textContent = fmtTime(TEST_DURATION_SECONDS);
        setCircle('ul-circle', 1);
        setStatus('Upload complete!', 'green');
        return finalMbps;
    }).catch(err => {
        clearInterval(timerHandle);
        clearDelayedHint();
        throw err;
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

        // Hide diagnosis panel at the start of each new test
        const diagPanel = document.getElementById('diagnosis-panel');
        if (diagPanel) { diagPanel.style.display = 'none'; diagPanel.style.opacity = '0'; }

        let dlSpeed = 0, ulSpeed = 0, latencyMs = null, jitterMs = null;

        try {
            // Always measure latency first
            setStatus('Measuring latency…', 'cyan');
            const latResult = await measureLatency();
            latencyMs = latResult.avg;
            jitterMs  = latResult.jitter;
            document.getElementById('ping-value').textContent   = latencyMs.toFixed(0);
            document.getElementById('jitter-value').textContent = jitterMs.toFixed(1);

            if (!ulOnly) dlSpeed = await runDownloadTest();
            if (!dlOnly) ulSpeed = await runUploadTest();

            setStatus('Test Complete 👇🏼', 'green');
            triggerCompletionEffect();
            showDiagnosis(latencyMs, jitterMs, dlSpeed, ulSpeed);

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

// ── Network score ─────────────────────────────────────────────────────
function computeNetworkScore(latencyMs, jitterMs, dlSpeed, ulSpeed) {
    // Each metric contributes up to 25 points → max 100
    let latPts, jitPts, dlPts, ulPts;

    if (latencyMs < 20)       latPts = 25;
    else if (latencyMs < 60)  latPts = 20;
    else if (latencyMs < 150) latPts = 10;
    else                       latPts = 3;

    if (jitterMs < 5)         jitPts = 25;
    else if (jitterMs < 20)   jitPts = 15;
    else                       jitPts = 3;

    if (dlSpeed >= 100)       dlPts = 25;
    else if (dlSpeed >= 25)   dlPts = 20;
    else if (dlSpeed >= 10)   dlPts = 12;
    else                       dlPts = 3;

    if (ulSpeed >= 20)        ulPts = 25;
    else if (ulSpeed >= 5)    ulPts = 15;
    else                       ulPts = 3;

    const score = latPts + jitPts + dlPts + ulPts;

    let grade, label, color;
    if (score >= 90)      { grade = 'A'; label = ' - Exceptional';  color = '#22c55e'; }
    else if (score >= 75) { grade = 'B'; label = ' - Good';         color = '#4ade80'; }
    else if (score >= 55) { grade = 'C'; label = ' - Fair';         color = '#f9ad16'; }
    else if (score >= 35) { grade = 'D'; label = ' - Poor';         color = '#f97316'; }
    else                   { grade = 'F'; label = ' - Critical';     color = '#ef4444'; }

    return { score, grade, label, color };
}

// ── Diagnosis / recommendations ───────────────────────────────────────
function showDiagnosis(latencyMs, jitterMs, dlSpeed, ulSpeed) {
    const panel     = document.getElementById('diagnosis-panel');
    const container = document.getElementById('diagnosis-items');
    if (!panel || !container) return;

    // Populate score banner
    const { score, grade, label, color } = computeNetworkScore(latencyMs, jitterMs, dlSpeed, ulSpeed);
    const scoreNum   = document.getElementById('score-number');
    const scoreGrade = document.getElementById('score-grade');
    const scoreLabel = document.getElementById('score-label');
    const scoreArc   = document.getElementById('score-arc');
    if (scoreNum)   scoreNum.textContent = score;
    if (scoreGrade) { scoreGrade.textContent = grade; scoreGrade.style.color = color; }
    if (scoreLabel) { scoreLabel.textContent = label; scoreLabel.style.color = color; }
    if (scoreArc)   { scoreArc.style.stroke = color; scoreArc.style.strokeDashoffset = String(263.9 * (1 - score / 100)); }

    container.innerHTML = '';
    const items = buildDiagnosisItems(latencyMs, jitterMs, dlSpeed, ulSpeed);

    items.forEach((item, idx) => {
        const el = document.createElement('div');
        const isLast = idx === items.length - 1;
        el.className = 'flex items-start gap-3 py-2.5 sm:py-3' + (isLast ? '' : ' border-b border-white/5');
        el.innerHTML = `
            <div class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-2xl font-bold" style="background:${item.bgColor}; color:${item.color}">${item.icon}</div>
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-0.5">
                    <span class="text-xs sm:text-sm font-mono uppercase tracking-wider text-gray-400">${item.metric}</span>
                    <span class="text-xs sm:text-sm font-semibold" style="color:${item.color}">${item.verdict}</span>
                </div>
                <p class="text-xs sm:text-sm text-gray-400 leading-relaxed">${item.recommendation}</p>
            </div>`;
        container.appendChild(el);
    });

    panel.style.display = '';
    // Trigger animation on next frame
    requestAnimationFrame(() => {
        panel.style.opacity  = '1';
        panel.style.transform = 'translateY(0)';
    });
}

function buildDiagnosisItems(latencyMs, jitterMs, dlSpeed, ulSpeed) {
    const items = [];

    // ── Latency ───────────────────────────────────────────────────────
    let latColor, latVerdict, latRec;
    if (latencyMs < 30) {
        latColor = '#22c55e';
        latVerdict = `Excellent — ${latencyMs.toFixed(0)} ms`;
        latRec = 'Exceptional TTFB. Clients will experience near-instant server responses — ideal for latency-sensitive APIs, real-time dashboards, and WebSocket connections.';
    } else if (latencyMs < 90) {
        latColor = '#22c55e';
        latVerdict = `Good — ${latencyMs.toFixed(0)} ms`;
        latRec = 'Good response latency. Suitable for most web applications; API calls and page loads will feel responsive to end users across regions.';
    } else if (latencyMs < 180) {
        latColor = '#f9ad16';
        latVerdict = `Fair — ${latencyMs.toFixed(0)} ms`;
        latRec = 'Moderate latency may degrade perceived performance. Consider deploying a CDN for streamable assets to reduce round-trip times.';
    } else {
        latColor = '#ef4444';
        latVerdict = `High — ${latencyMs.toFixed(0)} ms`;
        latRec = 'High latency will noticeably increase TTFB and hurt user experience. Investigate network path, hosting region, or consider edge/CDN deployment to bring content closer to users.';
    }
    items.push({ metric: 'Latency', icon: '⏱', bgColor: 'rgba(34,197,94,0.12)', color: latColor, verdict: latVerdict, recommendation: latRec });

    // ── Jitter ────────────────────────────────────────────────────────
    let jitColor, jitVerdict, jitRec;
    if (jitterMs < 5) {
        jitColor = '#22c55e';
        jitVerdict = `Stable — ${jitterMs.toFixed(1)} ms`;
        jitRec = 'Highly consistent response times. Reliable for WebSocket connections, Server-Sent Events, real-time collaboration features, and microservice-to-microservice calls.';
    } else if (jitterMs < 20) {
        jitColor = '#f9ad16';
        jitVerdict = `Moderate — ${jitterMs.toFixed(1)} ms`;
        jitRec = 'Some timing variability. May cause occasional retries in chained service calls. Monitor p95/p99 latency in production and review upstream provider SLAs.';
    } else {
        jitColor = '#ef4444';
        jitVerdict = `High — ${jitterMs.toFixed(1)} ms`;
        jitRec = 'Inconsistent response times will trigger client-side timeouts and degrade real-time features. Investigate NIC configuration, network contention, or switch to a more stable hosting provider.';
    }
    items.push({ metric: 'Jitter', icon: '〰', bgColor: 'rgba(168,85,247,0.12)', color: jitColor, verdict: jitVerdict, recommendation: jitRec });

    // ── Download (ingress) ────────────────────────────────────────────
    let dlColor, dlVerdict, dlRec;
    if (dlSpeed >= 100) {
        dlColor = '#22c55e';
        dlVerdict = `${dlSpeed.toFixed(1)} Mbps`;
        dlRec = 'Strong ingress bandwidth. Handles large file uploads, webhook payloads, and database sync traffic from many concurrent clients without link saturation.';
    } else if (dlSpeed >= 25) {
        dlColor = '#22c55e';
        dlVerdict = `${dlSpeed.toFixed(1)} Mbps`;
        dlRec = 'Adequate ingress for most web workloads. Monitor utilisation during traffic spikes to ensure upload-heavy endpoints do not saturate the link.';
    } else if (dlSpeed >= 10) {
        dlColor = '#f9ad16';
        dlVerdict = `${dlSpeed.toFixed(1)} Mbps`;
        dlRec = 'Limited ingress may become a bottleneck when clients send large request bodies or files concurrently. Consider rate limiting uploads or routing them through a dedicated ingress path.';
    } else {
        dlColor = '#ef4444';
        dlVerdict = `${dlSpeed.toFixed(1)} Mbps`;
        dlRec = 'Insufficient ingress bandwidth for production use with concurrent uploads or large API payloads. Upgrade your hosting plan or network connection immediately.';
    }
    items.push({ metric: 'Download', icon: '↓', bgColor: 'rgba(6,182,212,0.12)', color: dlColor, verdict: dlVerdict, recommendation: dlRec });

    // ── Upload (egress) ───────────────────────────────────────────────
    let ulColor, ulVerdict, ulRec;
    if (ulSpeed >= 20) {
        ulColor = '#22c55e';
        ulVerdict = `${ulSpeed.toFixed(1)} Mbps`;
        ulRec = 'Good egress capacity. Sufficient for serving concurrent users with web assets, API responses, and media. Monitor utilisation as traffic scales and set bandwidth alerts.';
    } else if (ulSpeed >= 5) {
        ulColor = '#f9ad16';
        ulVerdict = `${ulSpeed.toFixed(1)} Mbps`;
        ulRec = 'Moderate egress. Adequate for low-to-medium traffic volumes. Under heavy concurrent load or with large asset delivery, this link may saturate — offload static content to a CDN.';
    } else {
        ulColor = '#ef4444';
        ulVerdict = `${ulSpeed.toFixed(1)} Mbps`;
        ulRec = 'Critically low egress bandwidth for a production server. Concurrent users will experience slow page loads and elevated response times. Upgrade your plan or offload assets to a CDN immediately.';
    }
    items.push({ metric: 'Upload', icon: '↑', bgColor: 'rgba(168,85,247,0.12)', color: ulColor, verdict: ulVerdict, recommendation: ulRec });

    return items;
}
