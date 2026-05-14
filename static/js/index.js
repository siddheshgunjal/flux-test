document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    setupFluxAnimations();
    setupTestLogic();
    fetchSystemInfo();
});

// ── Constants matching app.py ─────────────────────────────────────────
const TEST_DURATION_SECONDS = 15;
const MAX_SPEED_MBPS        = 5000;

function _sleepWithAbort(ms, abortSignal) {
    return new Promise((resolve) => {
        if (abortSignal?.aborted) {
            resolve();
            return;
        }
        const timer = setTimeout(resolve, ms);
        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
        }
    });
}

function setServerStatsUnavailable() {
    const cpu = document.getElementById('stat-cpu');
    const mem = document.getElementById('stat-mem');
    const tx = document.getElementById('stat-net-tx');
    const rx = document.getElementById('stat-net-rx');
    if (cpu) cpu.textContent = '-- %';
    if (mem) mem.textContent = '-- %';
    if (tx) tx.textContent = '-- Mbps';
    if (rx) rx.textContent = '-- Mbps';
}

function createEmptyServerStatsSummary() {
    return {
        cpuPeak: 0,
        memoryPeak: 0,
        txPeak: 0,
        rxPeak: 0,
        txAvg: 0,
        rxAvg: 0,
        txStartBytes: null,
        txEndBytes: null,
        txStartTs: null,
        txEndTs: null,
        rxStartBytes: null,
        rxEndBytes: null,
        rxStartTs: null,
        rxEndTs: null,
    };
}

function updatePhaseAverage(summary, prefix, bytes, timestamp) {
    const startBytesKey = `${prefix}StartBytes`;
    const endBytesKey = `${prefix}EndBytes`;
    const startTsKey = `${prefix}StartTs`;
    const endTsKey = `${prefix}EndTs`;

    if (summary[startBytesKey] === null) {
        summary[startBytesKey] = bytes;
        summary[startTsKey] = timestamp;
    }

    summary[endBytesKey] = bytes;
    summary[endTsKey] = timestamp;
}

function computeAverageMbps(startBytes, endBytes, startTs, endTs) {
    if (
        startBytes === null ||
        endBytes === null ||
        startTs === null ||
        endTs === null ||
        endTs <= startTs ||
        endBytes < startBytes
    ) {
        return 0;
    }

    return ((endBytes - startBytes) * 8) / ((endTs - startTs) * 1_000_000);
}

function finalizeServerStatsSummary(summary) {
    return {
        cpuPeak: summary.cpuPeak,
        memoryPeak: summary.memoryPeak,
        txPeak: summary.txPeak,
        rxPeak: summary.rxPeak,
        txAvg: computeAverageMbps(summary.txStartBytes, summary.txEndBytes, summary.txStartTs, summary.txEndTs),
        rxAvg: computeAverageMbps(summary.rxStartBytes, summary.rxEndBytes, summary.rxStartTs, summary.rxEndTs),
    };
}

function renderServerStats(stats, nicDirection = 'none') {
    const cpu = document.getElementById('stat-cpu');
    const mem = document.getElementById('stat-mem');
    const tx = document.getElementById('stat-net-tx');
    const rx = document.getElementById('stat-net-rx');
    if (cpu) cpu.textContent = `${Number(stats.cpu_percent || 0).toFixed(1)} %`;
    if (mem) mem.textContent = `${Number(stats.memory_percent || 0).toFixed(1)} %`;

    if (nicDirection === 'tx') {
        if (tx) tx.textContent = `${Number(stats.net_tx_mbps || 0).toFixed(2)} Mbps`;
        if (rx) rx.textContent = '-- Mbps';
    } else if (nicDirection === 'rx') {
        // Keep the last TX sample from download visible during upload.
        if (rx) rx.textContent = `${Number(stats.net_rx_mbps || 0).toFixed(2)} Mbps`;
    } else {
        if (tx) tx.textContent = '-- Mbps';
        if (rx) rx.textContent = '-- Mbps';
    }
}

async function runServerStatsLoop(abortSignal, getNicDirection, onSample) {
    while (!abortSignal.aborted) {
        try {
            const res = await fetch('/stats', { cache: 'no-store', signal: abortSignal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const stats = await res.json();
            const nicDirection = getNicDirection();
            renderServerStats(stats, nicDirection);
            if (onSample) onSample(stats, nicDirection);
        } catch (_) {
            if (!abortSignal.aborted) setServerStatsUnavailable();
        }
        await _sleepWithAbort(1000, abortSignal);
    }
}

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

        try {
            const stats = await fetch('/stats', { cache: 'no-store' }).then(r => r.json());
            renderServerStats(stats, 'none');
        } catch (_) {
            setServerStatsUnavailable();
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
        setServerStatsUnavailable();
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

// ── Bufferbloat probe (runs concurrently during download) ─────────────
// Fires periodic pings to /bloat while the download saturates the link.
// Returns the average latency-under-load so we can compare with idle RTT.
async function _bloatProbeLoop(abortSignal) {
    const samples = [];
    while (!abortSignal.aborted) {
        try {
            const t0  = performance.now();
            const res = await fetch('/bloat', { cache: 'no-store', signal: abortSignal });
            if (!res.ok) break;
            await res.json();
            samples.push(performance.now() - t0);
        } catch (_) { break; }
        // Wait ~1 s between probes (skip if aborted)
        await _sleepWithAbort(1000, abortSignal);
    }
    if (samples.length === 0) return null;
    return samples.reduce((a, b) => a + b, 0) / samples.length;
}

// ── Download test ─────────────────────────────────────────────────────
// Returns { speed, bloatMs } — bloatMs is latency-under-load (or null).
async function runDownloadTest() {
    resetCard('dl');
    setStatus('Testing download…', 'cyan');

    const startTime = performance.now();
    let received    = 0;
    let testDone    = false;
    let rafHandle   = null;

    // Start bloat probe concurrently
    const bloatAC = new AbortController();
    const bloatPromise = _bloatProbeLoop(bloatAC.signal);

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

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.length;

            if ((performance.now() - startTime) / 1000 >= TEST_DURATION_SECONDS) {
                reader.cancel();
                break;
            }
        }

        testDone = true;
        if (rafHandle !== null) { cancelAnimationFrame(rafHandle); rafHandle = null; }

        // Stop bloat probes and collect result
        bloatAC.abort();
        const bloatMs = await bloatPromise;

        const finalMbps = (received * 8) / (TEST_DURATION_SECONDS * 1024 * 1024);

        document.getElementById('dl-speed').textContent = finalMbps.toFixed(1);
        document.getElementById('dl-bytes').textContent = (received / 1024 / 1024).toFixed(1) + ' MB';
        document.getElementById('dl-timer').textContent = fmtTime(TEST_DURATION_SECONDS);
        setCircle('dl-circle', 1);
        setStatus('Download complete!', 'green');
        return { speed: finalMbps, bloatMs };

    } catch (err) {
        testDone = true;
        if (rafHandle !== null) { cancelAnimationFrame(rafHandle); rafHandle = null; }
        bloatAC.abort();
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
    let nicDirection = 'none';

    async function run(dlOnly, ulOnly) {
        if (isTesting) return;
        isTesting = true;
        const statsAbortController = new AbortController();
        const serverStatsSummary = createEmptyServerStatsSummary();
        const statsLoopPromise = runServerStatsLoop(
            statsAbortController.signal,
            () => nicDirection,
            (stats, direction) => {
                const timestamp = Number(stats.timestamp || 0);
                serverStatsSummary.cpuPeak = Math.max(serverStatsSummary.cpuPeak, Number(stats.cpu_percent || 0));
                serverStatsSummary.memoryPeak = Math.max(serverStatsSummary.memoryPeak, Number(stats.memory_percent || 0));
                if (direction === 'tx') {
                    serverStatsSummary.txPeak = Math.max(serverStatsSummary.txPeak, Number(stats.net_tx_mbps || 0));
                    updatePhaseAverage(serverStatsSummary, 'tx', Number(stats.net_bytes_sent || 0), timestamp);
                } else if (direction === 'rx') {
                    serverStatsSummary.rxPeak = Math.max(serverStatsSummary.rxPeak, Number(stats.net_rx_mbps || 0));
                    updatePhaseAverage(serverStatsSummary, 'rx', Number(stats.net_bytes_recv || 0), timestamp);
                }
            }
        );
        disableButtons(true);
        [document.getElementById('dl-card'), document.getElementById('ul-card')].forEach((card) => {
            if (card) card.classList.remove('complete-glow');
        });

        // Hide diagnosis panel at the start of each new test
        const diagPanel = document.getElementById('diagnosis-panel');
        if (diagPanel) { diagPanel.style.display = 'none'; diagPanel.style.opacity = '0'; }

        let dlSpeed = 0, ulSpeed = 0, latencyMs = null, jitterMs = null, bloatMs = null;

        try {
            // Always measure latency first
            setStatus('Measuring latency…', 'cyan');
            nicDirection = 'none';
            const latResult = await measureLatency();
            latencyMs = latResult.avg;
            jitterMs  = latResult.jitter;
            document.getElementById('ping-value').textContent   = latencyMs.toFixed(0);
            document.getElementById('jitter-value').textContent = jitterMs.toFixed(1);

            if (!ulOnly) {
                nicDirection = 'tx';
                const dlResult = await runDownloadTest();
                dlSpeed = dlResult.speed;
                bloatMs = dlResult.bloatMs;
                // Display bloat in info bar
                const bloatEl = document.getElementById('bloat-value');
                if (bloatEl && bloatMs !== null) {
                    const delta = Math.max(0, bloatMs - latencyMs);
                    bloatEl.textContent = '+' + delta.toFixed(0);
                }
            }
            if (!dlOnly) {
                nicDirection = 'rx';
                ulSpeed = await runUploadTest();
            }

            setStatus('Test Complete 👇🏼', 'green');
            nicDirection = 'none';
            triggerCompletionEffect();
            showDiagnosis(latencyMs, jitterMs, dlSpeed, ulSpeed, bloatMs, finalizeServerStatsSummary(serverStatsSummary));

        } catch (e) {
            setStatus(`Error: ${e.message}`, 'red');
            console.error(e);
        } finally {
            nicDirection = 'none';
            statsAbortController.abort();
            await statsLoopPromise;
            isTesting = false;
            disableButtons(false);
        }
    }

    document.getElementById('start-all-btn').addEventListener('click', () => run(false, false));
}

function computeThroughputRelativeDelta(measuredMbps, nicAverageMbps) {
    if (!(nicAverageMbps > 0) || !(measuredMbps > 0)) return null;
    return Math.abs(nicAverageMbps - measuredMbps) / Math.max(nicAverageMbps, measuredMbps);
}

function scoreThroughputAlignment(measuredMbps, nicAverageMbps, maxPoints) {
    const relativeDelta = computeThroughputRelativeDelta(measuredMbps, nicAverageMbps);
    if (relativeDelta === null) return maxPoints * 0.5; // neutral when no sample
    if (relativeDelta <= 0.15) return maxPoints;
    if (relativeDelta <= 0.35) return maxPoints * 0.65;
    if (relativeDelta <= 0.6) return maxPoints * 0.3;
    return maxPoints * 0.1;
}

// ── Network score ─────────────────────────────────────────────────────
function computeNetworkScore(latencyMs, jitterMs, dlSpeed, ulSpeed, bloatMs, serverStatsSummary = createEmptyServerStatsSummary()) {
    // Weighted scoring (max 100): core network quality = 70, server/system bottlenecks = 30.
    const NET_W = 14;
    const SYS_W = 7.5;
    let latPts, jitPts, dlPts, ulPts, bloatPts, cpuPts, memPts;

    if (latencyMs < 20)       latPts = NET_W;
    else if (latencyMs < 60)  latPts = NET_W * 0.8;
    else if (latencyMs < 150) latPts = NET_W * 0.45;
    else                       latPts = NET_W * 0.1;

    if (jitterMs < 5)         jitPts = NET_W;
    else if (jitterMs < 20)   jitPts = NET_W * 0.6;
    else                       jitPts = NET_W * 0.1;

    if (dlSpeed >= 100)       dlPts = NET_W;
    else if (dlSpeed >= 25)   dlPts = NET_W * 0.8;
    else if (dlSpeed >= 10)   dlPts = NET_W * 0.5;
    else                       dlPts = NET_W * 0.1;

    if (ulSpeed >= 20)        ulPts = NET_W;
    else if (ulSpeed >= 5)    ulPts = NET_W * 0.6;
    else                       ulPts = NET_W * 0.1;

    // Bufferbloat: delta = loaded RTT - idle RTT
    const bloatDelta = (bloatMs != null && latencyMs != null) ? Math.max(0, bloatMs - latencyMs) : null;
    if (bloatDelta === null)       bloatPts = NET_W * 0.5;
    else if (bloatDelta < 15)      bloatPts = NET_W;
    else if (bloatDelta < 50)      bloatPts = NET_W * 0.7;
    else if (bloatDelta < 150)     bloatPts = NET_W * 0.3;
    else                            bloatPts = NET_W * 0.1;

    const cpuPeak = serverStatsSummary.cpuPeak || 0;
    if (cpuPeak < 60)         cpuPts = SYS_W;
    else if (cpuPeak < 80)    cpuPts = SYS_W * 0.75;
    else if (cpuPeak < 90)    cpuPts = SYS_W * 0.35;
    else                       cpuPts = SYS_W * 0.1;

    const memoryPeak = serverStatsSummary.memoryPeak || 0;
    if (memoryPeak < 70)       memPts = SYS_W;
    else if (memoryPeak < 85)  memPts = SYS_W * 0.75;
    else if (memoryPeak < 95)  memPts = SYS_W * 0.3;
    else                        memPts = SYS_W * 0.1;

    const txPts = scoreThroughputAlignment(dlSpeed, serverStatsSummary.txAvg || 0, SYS_W);
    const rxPts = scoreThroughputAlignment(ulSpeed, serverStatsSummary.rxAvg || 0, SYS_W);

    const score = Math.round(latPts + jitPts + dlPts + ulPts + bloatPts + cpuPts + memPts + txPts + rxPts);

    let grade, label, color;
    if (score >= 90)      { grade = 'A'; label = ' - Exceptional';  color = '#22c55e'; }
    else if (score >= 75) { grade = 'B'; label = ' - Good';         color = '#4ade80'; }
    else if (score >= 55) { grade = 'C'; label = ' - Fair';         color = '#f9ad16'; }
    else if (score >= 35) { grade = 'D'; label = ' - Poor';         color = '#f97316'; }
    else                   { grade = 'F'; label = ' - Critical';     color = '#ef4444'; }

    return { score, grade, label, color };
}

// ── Diagnosis / recommendations ───────────────────────────────────────
function showDiagnosis(latencyMs, jitterMs, dlSpeed, ulSpeed, bloatMs, serverStatsSummary = createEmptyServerStatsSummary()) {
    const panel     = document.getElementById('diagnosis-panel');
    const container = document.getElementById('diagnosis-items');
    if (!panel || !container) return;

    // Populate score banner
    const { score, grade, label, color } = computeNetworkScore(latencyMs, jitterMs, dlSpeed, ulSpeed, bloatMs, serverStatsSummary);
    const scoreNum   = document.getElementById('score-number');
    const scoreGrade = document.getElementById('score-grade');
    const scoreLabel = document.getElementById('score-label');
    const scoreArc   = document.getElementById('score-arc');
    if (scoreNum)   scoreNum.textContent = score;
    if (scoreGrade) { scoreGrade.textContent = grade; scoreGrade.style.color = color; }
    if (scoreLabel) { scoreLabel.textContent = label; scoreLabel.style.color = color; }
    if (scoreArc)   { scoreArc.style.stroke = color; scoreArc.style.strokeDashoffset = String(263.9 * (1 - score / 100)); }

    // Store raw values for PNG download
    const serverName = document.getElementById('server-name')?.textContent || 'Server';
    panel.dataset.latency  = latencyMs;
    panel.dataset.jitter   = jitterMs;
    panel.dataset.dlSpeed  = dlSpeed;
    panel.dataset.ulSpeed  = ulSpeed;
    panel.dataset.bloat    = bloatMs != null ? bloatMs : '';
    panel.dataset.cpuPeak  = serverStatsSummary.cpuPeak;
    panel.dataset.memoryPeak = serverStatsSummary.memoryPeak;
    panel.dataset.txPeak   = serverStatsSummary.txPeak;
    panel.dataset.rxPeak   = serverStatsSummary.rxPeak;
    panel.dataset.txAvg    = serverStatsSummary.txAvg;
    panel.dataset.rxAvg    = serverStatsSummary.rxAvg;
    panel.dataset.server   = serverName;
    panel.dataset.ready    = '1';

    container.innerHTML = '';
    const items = buildDiagnosisItems(latencyMs, jitterMs, dlSpeed, ulSpeed, bloatMs, serverStatsSummary);

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

// ── Shareable result card (Canvas PNG) ───────────────────────────────
function _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
    return lines.length;
}

function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function downloadResultCard() {
    const panel = document.getElementById('diagnosis-panel');
    if (!panel || !panel.dataset.ready) return;

    const latencyMs  = parseFloat(panel.dataset.latency)  || 0;
    const jitterMs   = parseFloat(panel.dataset.jitter)   || 0;
    const dlSpeed    = parseFloat(panel.dataset.dlSpeed)  || 0;
    const ulSpeed    = parseFloat(panel.dataset.ulSpeed)  || 0;
    const bloatMs    = panel.dataset.bloat !== '' ? parseFloat(panel.dataset.bloat) : null;
    const serverName = panel.dataset.server || 'Server';

    const { score, grade, label, color } = computeNetworkScore(latencyMs, jitterMs, dlSpeed, ulSpeed, bloatMs);
    const gradeLabel = label.replace(/^ - /, '');
    const diagItems  = buildDiagnosisItems(latencyMs, jitterMs, dlSpeed, ulSpeed, bloatMs);

    // Single-column card matching the Diagnosis panel layout
    const W = 640, H = 800, DPR = 2;
    const PAD = 24;

    const canvas = document.createElement('canvas');
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const SF = '-apple-system,BlinkMacSystemFont,Inter,sans-serif';
    const MF = '"JetBrains Mono","Courier New",monospace';

    // ── Background ───────────────────────────────────────────────────
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, W, H);
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,   'rgba(6,182,212,0.06)');
    bgGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
    bgGrad.addColorStop(1,   'rgba(168,85,247,0.06)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Card border
    ctx.save();
    _roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Top accent line (cyan → purple gradient)
    const topGrad = ctx.createLinearGradient(0, 0, W, 0);
    topGrad.addColorStop(0,   'transparent');
    topGrad.addColorStop(0.4, 'rgba(6,182,212,0.7)');
    topGrad.addColorStop(0.6, 'rgba(168,85,247,0.5)');
    topGrad.addColorStop(1,   'transparent');
    ctx.strokeStyle = topGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD, 1); ctx.lineTo(W - PAD, 1);
    ctx.stroke();

    // ── Header — FluxTest branding ────────────────────────────────────
    ctx.font = `300 26px ${SF}`;
    ctx.fillStyle = '#ffffff';
    const fluxW = ctx.measureText('Flux').width;
    ctx.fillText('Flux', PAD, 38);
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('Test', PAD + fluxW, 38);

    ctx.font = `400 10px ${MF}`;
    ctx.fillStyle = 'rgba(188, 188, 188, 0.85)';
    ctx.fillText('Network Diagnosis Report', PAD, 53);

    ctx.textAlign = 'right';
    ctx.font = `400 12px ${MF}`;
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(serverName, W - PAD, 38);
    ctx.font = `400 10px ${MF}`;
    ctx.fillStyle = '#6e737a';
    ctx.fillText(new Date().toLocaleString(), W - PAD, 53);
    ctx.textAlign = 'left';

    // Header separator
    const HEADER_BOTTOM = 62;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, HEADER_BOTTOM); ctx.lineTo(W - PAD, HEADER_BOTTOM);
    ctx.stroke();

    // ── Score Banner — matches panel score section ────────────────────
    const RING_R = 48, RING_CX = W / 2;
    const RING_CY = HEADER_BOTTOM + 16 + RING_R;   // 126

    // Background ring track
    ctx.beginPath();
    ctx.arc(RING_CX, RING_CY, RING_R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Score arc
    ctx.save();
    ctx.beginPath();
    ctx.arc(RING_CX, RING_CY, RING_R, -Math.PI / 2, -Math.PI / 2 + (score / 100) * Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Score number + /100 inside ring
    ctx.textAlign = 'center';
    ctx.font = `300 28px ${SF}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score, RING_CX, RING_CY + 9);
    ctx.font = `400 10px ${MF}`;
    ctx.fillStyle = '#848689';
    ctx.fillText('/100', RING_CX, RING_CY + 23);

    // Grade letter + label — flex items-center justify-center (matches panel)
    const ringBottom = RING_CY + RING_R;     // 174
    const gradeBaseY = ringBottom + 40;      // 204

    ctx.font = `bold 32px ${SF}`;
    const gradeW = ctx.measureText(grade).width;
    ctx.font = `500 14px ${SF}`;
    const labelW  = ctx.measureText(gradeLabel).width;
    const rowW    = gradeW + 10 + labelW;
    const rowX    = Math.round((W - rowW) / 2);

    ctx.textAlign = 'left';
    ctx.font = `bold 32px ${SF}`;
    ctx.fillStyle = color;
    ctx.fillText(grade, rowX, gradeBaseY);

    ctx.font = `500 14px ${SF}`;
    ctx.fillStyle = color;
    ctx.fillText(gradeLabel, rowX + gradeW + 10, gradeBaseY - 5);   // slight raise to optically align

    // "OVERALL SCORE" sub-label
    ctx.textAlign = 'center';
    ctx.font = `400 10px ${MF}`;
    ctx.fillStyle = 'rgba(172, 175, 181, 0.75)';
    ctx.fillText('OVERALL SCORE', RING_CX, gradeBaseY + 20);

    // Score section separator (matches border-b border-white/10)
    const SCORE_BOTTOM = gradeBaseY + 36;   // 240
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, SCORE_BOTTOM); ctx.lineTo(W - PAD, SCORE_BOTTOM);
    ctx.stroke();

    ctx.textAlign = 'left';

    // ── Per-metric rows — matches panel diagnosis-items ───────────────
    const ROW_START_Y = SCORE_BOTTOM + 8;       // 248
    const FOOTER_SEP  = H - 44;                 // 656
    const ROW_H       = (FOOTER_SEP - ROW_START_Y) / diagItems.length;  // ~102

    const ICON_SZ   = 40;
    const ROW_PAD_T = 12;   // top padding per row (matches py-3)
    const REC_MAX_W = W - PAD - ICON_SZ - 14 - PAD;   // 538

    diagItems.forEach((m, i) => {
        const rowY     = ROW_START_Y + i * ROW_H;
        const iconTopY = rowY + ROW_PAD_T;   // items-start: icon aligns to text top
        const tx       = PAD + ICON_SZ + 14;

        // Icon box (matches w-10 h-10 rounded-lg)
        ctx.save();
        _roundRect(ctx, PAD, iconTopY, ICON_SZ, ICON_SZ, 8);
        ctx.fillStyle = m.bgColor;
        ctx.fill();
        ctx.restore();

        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = m.color;
        ctx.fillText(m.icon, PAD + ICON_SZ / 2, iconTopY + ICON_SZ / 2 + 10);
        ctx.textAlign = 'left';

        // Metric name + verdict on same baseline (matches flex items-baseline gap-x-2)
        ctx.font = `400 14px ${MF}`;
        ctx.fillStyle = 'rgba(180, 180, 180, 0.9)';
        const metricW = ctx.measureText(m.metric.toUpperCase()).width;
        ctx.fillText(m.metric.toUpperCase(), tx, iconTopY + 13);

        ctx.font = `600 14px ${SF}`;
        ctx.fillStyle = m.color;
        ctx.fillText(m.verdict, tx + metricW + 8, iconTopY + 13);

        // Recommendation text (matches text-xs text-gray-400 leading-relaxed)
        ctx.font = `400 12px ${SF}`;
        ctx.fillStyle = 'rgba(156,163,175,0.78)';
        _wrapText(ctx, m.recommendation, tx, iconTopY + 29, REC_MAX_W, 14);

        // Row separator (matches border-b border-white/5)
        if (i < diagItems.length - 1) {
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(PAD, rowY + ROW_H); ctx.lineTo(W - PAD, rowY + ROW_H);
            ctx.stroke();
        }
    });

    // ── Footer ───────────────────────────────────────────────────────
    const ftGrad = ctx.createLinearGradient(0, 0, W, 0);
    ftGrad.addColorStop(0,   'transparent');
    ftGrad.addColorStop(0.5, 'rgba(168,85,247,0.25)');
    ftGrad.addColorStop(1,   'transparent');
    ctx.strokeStyle = ftGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, FOOTER_SEP + 8); ctx.lineTo(W - PAD, FOOTER_SEP + 8);
    ctx.stroke();

    ctx.font = `400 9px ${MF}`;
    ctx.fillStyle = '#374151';
    ctx.fillText('github.com/siddheshgunjal/flux-test', PAD, H - 13);
    ctx.textAlign = 'right';
    ctx.fillText('FluxTest · Self-Hosted Network Diagnosis', W - PAD, H - 13);
    ctx.textAlign = 'left';

    // ── Trigger download ─────────────────────────────────────────────
    const link = document.createElement('a');
    link.download = `fluxtest-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function buildThroughputAlignment(metricLabel, measuredMbps, nicAverageMbps, directionLabel) {
    if (!(nicAverageMbps > 0) || !(measuredMbps > 0)) {
        return {
            color: '#6b7280',
            verdict: 'No sample',
            recommendation: `No ${directionLabel} sample was captured for ${metricLabel.toLowerCase()} analysis. Confirm the stats loop was running and that the selected interface accounts for this traffic.`,
        };
    }

    const deltaMbps = Math.abs(nicAverageMbps - measuredMbps);
    const relativeDelta = deltaMbps / Math.max(nicAverageMbps, measuredMbps);

    if (relativeDelta <= 0.15) {
        return {
            color: '#22c55e',
            verdict: `Aligned — ${nicAverageMbps.toFixed(1)} Mbps avg`,
            recommendation: `${directionLabel} average throughput closely matched the measured ${metricLabel.toLowerCase()} result. The server-side counter and application-level result are consistent within ${(relativeDelta * 100).toFixed(0)}%.`,
        };
    }

    if (relativeDelta <= 0.35) {
        return {
            color: '#f9ad16',
            verdict: `Offset — ${nicAverageMbps.toFixed(1)} Mbps avg`,
            recommendation: `${directionLabel} average throughput differed from the measured ${metricLabel.toLowerCase()} result by ${deltaMbps.toFixed(1)} Mbps (${(relativeDelta * 100).toFixed(0)}%). This suggests some overhead, proxying, or interface-accounting differences.`,
        };
    }

    return {
        color: '#ef4444',
        verdict: `Mismatch — ${nicAverageMbps.toFixed(1)} Mbps avg`,
        recommendation: `${directionLabel} average throughput differed sharply from the measured ${metricLabel.toLowerCase()} result by ${deltaMbps.toFixed(1)} Mbps (${(relativeDelta * 100).toFixed(0)}%). The reported test speed and NIC counters are not closely matched, so a proxy, tunnel, alternate interface, or measurement-path discrepancy is likely involved.`,
    };
}

function buildDiagnosisItems(latencyMs, jitterMs, dlSpeed, ulSpeed, bloatMs, serverStatsSummary = createEmptyServerStatsSummary()) {
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

    // ── Bufferbloat ───────────────────────────────────────────────────
    const bloatDelta = (bloatMs != null && latencyMs != null) ? Math.max(0, bloatMs - latencyMs) : null;
    let bbColor, bbVerdict, bbRec;
    if (bloatDelta === null) {
        bbColor = '#6b7280';
        bbVerdict = 'No data';
        bbRec = 'Bufferbloat could not be measured. This may occur if the download test was skipped or the probe requests were blocked.';
    } else if (bloatDelta < 15) {
        bbColor = '#22c55e';
        bbVerdict = `Minimal — +${bloatDelta.toFixed(0)} ms`;
        bbRec = 'Negligible latency increase under load. Your network path has proper queue management (SQM/fq_codel). Real-time traffic will not be disrupted during bulk transfers.';
    } else if (bloatDelta < 50) {
        bbColor = '#f9ad16';
        bbVerdict = `Moderate — +${bloatDelta.toFixed(0)} ms`;
        bbRec = 'Noticeable latency spike under saturation. Interactive sessions (SSH, WebSocket) may feel sluggish during heavy transfers. Consider enabling SQM or fq_codel on your router.';
    } else if (bloatDelta < 150) {
        bbColor = '#f97316';
        bbVerdict = `High — +${bloatDelta.toFixed(0)} ms`;
        bbRec = 'Significant buffer bloat detected. Real-time protocols and interactive sessions will degrade severely during bulk data transfers. Enable smart queue management (SQM) on your router or upstream gateway.';
    } else {
        bbColor = '#ef4444';
        bbVerdict = `Severe — +${bloatDelta.toFixed(0)} ms`;
        bbRec = 'Extreme buffer bloat — latency balloons under load. VoIP, gaming, and real-time APIs become unusable during transfers. SQM/fq_codel is essential. Consider hardware with better queue management.';
    }
    items.push({ metric: 'Bloat', icon: '🫧', bgColor: 'rgba(249,115,22,0.12)', color: bbColor, verdict: bbVerdict, recommendation: bbRec });

    // ── Server CPU ───────────────────────────────────────────────────
    const cpuPeak = serverStatsSummary.cpuPeak || 0;
    let cpuColor, cpuVerdict, cpuRec;
    if (cpuPeak < 60) {
        cpuColor = '#22c55e';
        cpuVerdict = `Healthy — ${cpuPeak.toFixed(1)} % peak`;
        cpuRec = 'The server retained CPU headroom during the test. Application workers are unlikely to be the bottleneck at the measured traffic level.';
    } else if (cpuPeak < 85) {
        cpuColor = '#f9ad16';
        cpuVerdict = `Elevated — ${cpuPeak.toFixed(1)} % peak`;
        cpuRec = 'CPU utilisation climbed noticeably during the test. This is acceptable for bursts, but sustained traffic may begin to impact latency and throughput.';
    } else {
        cpuColor = '#ef4444';
        cpuVerdict = `Saturated — ${cpuPeak.toFixed(1)} % peak`;
        cpuRec = 'Server CPU approached saturation during the test, so measured results may be constrained by compute rather than network quality. Increase worker capacity or optimize request handling.';
    }
    items.push({ metric: 'Server CPU', icon: '⚙', bgColor: 'rgba(34,197,94,0.12)', color: cpuColor, verdict: cpuVerdict, recommendation: cpuRec });

    // ── Server Memory ────────────────────────────────────────────────
    const memoryPeak = serverStatsSummary.memoryPeak || 0;
    let memColor, memVerdict, memRec;
    if (memoryPeak < 70) {
        memColor = '#22c55e';
        memVerdict = `Healthy — ${memoryPeak.toFixed(1)} % peak`;
        memRec = 'Memory pressure remained low, so the server likely had sufficient RAM available throughout the test window.';
    } else if (memoryPeak < 90) {
        memColor = '#f9ad16';
        memVerdict = `Tight — ${memoryPeak.toFixed(1)} % peak`;
        memRec = 'Memory usage is getting high enough that burst traffic could increase GC pressure or trigger reclaim. Monitor resident set size and concurrent worker counts.';
    } else {
        memColor = '#ef4444';
        memVerdict = `Critical — ${memoryPeak.toFixed(1)} % peak`;
        memRec = 'Server memory was close to exhaustion during the test, which can distort network results via swapping or aggressive reclaim. Add RAM or reduce process footprint.';
    }
    items.push({ metric: 'Server Memory', icon: '🧠', bgColor: 'rgba(168,85,247,0.12)', color: memColor, verdict: memVerdict, recommendation: memRec });

    // ── Server TX / RX ───────────────────────────────────────────────
    const txAvg = serverStatsSummary.txAvg || 0;
    const txAnalysis = buildThroughputAlignment('Download', dlSpeed, txAvg, 'Server NIC transmit');
    const txColor = txAnalysis.color;
    const txVerdict = txAnalysis.verdict;
    const txRec = txAnalysis.recommendation;
    items.push({ metric: 'Server TX', icon: '⇢', bgColor: 'rgba(6,182,212,0.12)', color: txColor, verdict: txVerdict, recommendation: txRec });

    const rxAvg = serverStatsSummary.rxAvg || 0;
    const rxAnalysis = buildThroughputAlignment('Upload', ulSpeed, rxAvg, 'Server NIC receive');
    const rxColor = rxAnalysis.color;
    const rxVerdict = rxAnalysis.verdict;
    const rxRec = rxAnalysis.recommendation;
    items.push({ metric: 'Server RX', icon: '⇠', bgColor: 'rgba(249,115,22,0.12)', color: rxColor, verdict: rxVerdict, recommendation: rxRec });

    return items;
}
