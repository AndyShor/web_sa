// Web Spectrum Analyzer - RTL-SDR Wideband Scanner
// Using locally bundled library (no CDN dependency)

import { RTL2832U_Provider } from "./rtlsdr-bundle.js";

// ============ FFT Implementation ============
class FFT {
    constructor(size) {
        this.size = size;
        this.cosTable = new Float32Array(size / 2);
        this.sinTable = new Float32Array(size / 2);
        for (let i = 0; i < size / 2; i++) {
            this.cosTable[i] = Math.cos(2 * Math.PI * i / size);
            this.sinTable[i] = Math.sin(2 * Math.PI * i / size);
        }
        this.reverseTable = new Uint32Array(size);
        const bits = Math.log2(size);
        for (let i = 0; i < size; i++) {
            let reversed = 0;
            for (let j = 0; j < bits; j++) {
                reversed = (reversed << 1) | ((i >> j) & 1);
            }
            this.reverseTable[i] = reversed;
        }
    }

    forward(real, imag) {
        const n = this.size;
        for (let i = 0; i < n; i++) {
            const j = this.reverseTable[i];
            if (j > i) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
        }
        for (let size = 2; size <= n; size *= 2) {
            const halfSize = size / 2;
            const step = n / size;
            for (let i = 0; i < n; i += size) {
                for (let j = 0; j < halfSize; j++) {
                    const k = j * step;
                    const cos = this.cosTable[k];
                    const sin = this.sinTable[k];
                    const tReal = real[i + j + halfSize] * cos + imag[i + j + halfSize] * sin;
                    const tImag = imag[i + j + halfSize] * cos - real[i + j + halfSize] * sin;
                    real[i + j + halfSize] = real[i + j] - tReal;
                    imag[i + j + halfSize] = imag[i + j] - tImag;
                    real[i + j] += tReal;
                    imag[i + j] += tImag;
                }
            }
        }
    }

    fftshift(arr) {
        const half = arr.length / 2;
        const result = new Float32Array(arr.length);
        for (let i = 0; i < half; i++) {
            result[i] = arr[i + half];
            result[i + half] = arr[i];
        }
        return result;
    }
}

// ============ Color Maps ============
function viridis(t) {
    t = Math.max(0, Math.min(1, t));
    const c0 = [0.267004, 0.004874, 0.329415];
    const c1 = [0.282327, 0.140926, 0.457517];
    const c2 = [0.253935, 0.265254, 0.529983];
    const c3 = [0.206756, 0.371758, 0.553117];
    const c4 = [0.163625, 0.471133, 0.558148];
    const c5 = [0.127568, 0.566949, 0.550556];
    const c6 = [0.134692, 0.658636, 0.517649];
    const c7 = [0.266941, 0.748751, 0.440573];
    const c8 = [0.477504, 0.821444, 0.318195];
    const c9 = [0.741388, 0.873449, 0.149561];
    const c10 = [0.993248, 0.906157, 0.143936];
    
    const colors = [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10];
    const idx = t * (colors.length - 1);
    const i = Math.floor(idx);
    const f = idx - i;
    
    if (i >= colors.length - 1) {
        return colors[colors.length - 1].map(v => Math.round(v * 255));
    }
    
    const r = Math.round((colors[i][0] * (1 - f) + colors[i + 1][0] * f) * 255);
    const g = Math.round((colors[i][1] * (1 - f) + colors[i + 1][1] * f) * 255);
    const b = Math.round((colors[i][2] * (1 - f) + colors[i + 1][2] * f) * 255);
    
    return [r, g, b];
}

function drawColorbar(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth * dpr;
    const height = 20 * dpr;
    canvas.width = width;
    canvas.height = height;
    
    for (let x = 0; x < width; x++) {
        const t = x / width;
        const [r, g, b] = viridis(t);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, 0, 1, height);
    }
}

// ============ Spectrum Analyzer Class ============
class SpectrumAnalyzer {
    constructor() {
        this.device = null;
        this.isRunning = false;
        this.stopRequested = false;
        
        this.waterfallCanvas = document.getElementById('waterfall');
        this.spectrumCanvas = document.getElementById('spectrum');
        this.waterfallCtx = null;
        this.spectrumCtx = null;
        
        this.spectrogram = null;
        this.freqs = null;
        this.currentRow = 0;
        
        this.initCanvases();
    }
    
    initCanvases() {
        const dpr = window.devicePixelRatio || 1;
        
        // Waterfall canvas
        const wRect = this.waterfallCanvas.getBoundingClientRect();
        this.waterfallCanvas.width = wRect.width * dpr;
        this.waterfallCanvas.height = wRect.height * dpr;
        this.waterfallCtx = this.waterfallCanvas.getContext('2d');
        // Don't scale context - we'll handle DPR in drawing code
        
        // Spectrum canvas
        const sRect = this.spectrumCanvas.getBoundingClientRect();
        this.spectrumCanvas.width = sRect.width * dpr;
        this.spectrumCanvas.height = sRect.height * dpr;
        this.spectrumCtx = this.spectrumCanvas.getContext('2d');
        this.spectrumCtx.scale(dpr, dpr);  // Scale for line drawing
        
        // Store both CSS and actual pixel dimensions
        this.displayWidth = wRect.width;
        this.displayHeight = wRect.height;
        this.spectrumDisplayWidth = sRect.width;
        this.spectrumHeight = sRect.height;
        this.dpr = dpr;
        
        // Clear canvases
        this.waterfallCtx.fillStyle = '#000';
        this.waterfallCtx.fillRect(0, 0, this.waterfallCanvas.width, this.waterfallCanvas.height);
        this.spectrumCtx.fillStyle = '#0a0a1a';
        this.spectrumCtx.fillRect(0, 0, this.spectrumDisplayWidth, this.spectrumHeight);
    }
    
    async connect() {
        if (!navigator.usb) {
            throw new Error('WebUSB not supported. Use Chrome/Edge on desktop or Android.');
        }
        
        try {
            console.log('Creating RTL2832U_Provider...');
            const provider = new RTL2832U_Provider();
            
            console.log('Requesting device...');
            this.device = await provider.get();
            
            console.log('Device connected');
            return true;
        } catch (err) {
            console.error('Connection error:', err);
            
            if (err.message && err.message.includes('No device selected')) {
                throw new Error('No device selected. Please select your RTL-SDR.');
            }
            if (err.name === 'NotFoundError') {
                throw new Error('No RTL-SDR found. Check USB connection.');
            }
            if (err.name === 'SecurityError') {
                throw new Error('USB access denied. HTTPS required.');
            }
            
            throw new Error('Connection failed: ' + (err.message || err));
        }
    }
    
    async disconnect() {
        if (this.device) {
            try {
                await this.device.close();
            } catch (e) {
                console.warn('Error closing device:', e);
            }
            this.device = null;
        }
    }
    
    async scan(startFreq, stopFreq, numRows, gain, fftSize, edgeTrim) {
        if (!this.device) throw new Error('Not connected');
        if (this.isRunning) throw new Error('Scan already in progress');
        
        this.isRunning = true;
        this.stopRequested = false;
        
        const chunkBandwidth = 2.4e6;
        const trimBins = Math.floor(fftSize * edgeTrim / 100);
        const usableBins = fftSize - 2 * trimBins;
        const usableBandwidth = chunkBandwidth * (usableBins / fftSize);
        
        const totalBandwidth = stopFreq - startFreq;
        const numChunks = Math.max(1, Math.ceil(totalBandwidth / usableBandwidth));
        const stepSize = totalBandwidth / numChunks;
        
        const centerFreqs = [];
        for (let i = 0; i < numChunks; i++) {
            centerFreqs.push(startFreq + stepSize / 2 + i * stepSize);
        }
        
        const actualChunkBW = Math.min(3.2e6, Math.max(0.9e6, stepSize / (usableBins / fftSize)));
        
        const totalOutputBins = usableBins * numChunks;
        this.freqs = new Float32Array(totalOutputBins);
        for (let i = 0; i < numChunks; i++) {
            const cf = centerFreqs[i];
            for (let j = 0; j < usableBins; j++) {
                const binFreq = cf - actualChunkBW / 2 + (trimBins + j) * (actualChunkBW / fftSize);
                this.freqs[i * usableBins + j] = binFreq;
            }
        }
        
        this.spectrogram = new Array(numRows);
        for (let i = 0; i < numRows; i++) {
            this.spectrogram[i] = new Float32Array(totalOutputBins);
        }
        
        document.getElementById('infoBW').textContent = (totalBandwidth / 1e6).toFixed(2) + ' MHz';
        document.getElementById('infoChunks').textContent = numChunks;
        document.getElementById('infoRes').textContent = (actualChunkBW / fftSize / 1e3).toFixed(2) + ' kHz';
        document.getElementById('infoBins').textContent = totalOutputBins;
        
        await this.device.setSampleRate(actualChunkBW);
        if (gain !== 'auto') {
            await this.device.setGain(parseFloat(gain) * 10);
        } else {
            await this.device.setGain(null);
        }
        
        const window = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
        }
        
        const fft = new FFT(fftSize);
        
        await this.device.setCenterFrequency(centerFreqs[0]);
        await this.device.resetBuffer();
        await this.device.readSamples(2048);  // Discard settling samples
        
        for (let row = 0; row < numRows && !this.stopRequested; row++) {
            this.currentRow = row;
            
            for (let chunkIdx = 0; chunkIdx < numChunks && !this.stopRequested; chunkIdx++) {
                const cf = centerFreqs[chunkIdx];
                await this.device.setCenterFrequency(cf);
                
                if (row === 0 && chunkIdx > 0) {
                    await this.device.readSamples(512);  // Discard settling samples
                }
                
                // v2.0.4 API: readSamples returns { frequency, directSampling, data }
                // data is an ArrayBuffer, need to wrap in Uint8Array
                const result = await this.device.readSamples(fftSize);
                const rawSamples = new Uint8Array(result.data);
                
                if (!rawSamples || rawSamples.length < fftSize * 2) {
                    console.warn('Insufficient samples received:', rawSamples?.length);
                    continue;
                }
                
                const real = new Float32Array(fftSize);
                const imag = new Float32Array(fftSize);
                for (let i = 0; i < fftSize; i++) {
                    real[i] = ((rawSamples[i * 2] - 127.5) / 127.5) * window[i];
                    imag[i] = ((rawSamples[i * 2 + 1] - 127.5) / 127.5) * window[i];
                }
                
                fft.forward(real, imag);
                
                const magnitude = new Float32Array(fftSize);
                for (let i = 0; i < fftSize; i++) {
                    const mag = real[i] * real[i] + imag[i] * imag[i];
                    magnitude[i] = 10 * Math.log10(mag + 1e-10);
                }
                
                const shifted = fft.fftshift(magnitude);
                const trimmed = shifted.slice(trimBins, fftSize - trimBins);
                
                const startBin = chunkIdx * usableBins;
                for (let i = 0; i < usableBins; i++) {
                    this.spectrogram[row][startBin + i] = trimmed[i];
                }
            }
            
            if (row % 5 === 0 || row === numRows - 1) {
                this.drawWaterfall(row + 1);
                this.drawSpectrum(row);
                this.updateProgress((row + 1) / numRows * 100);
                await this.sleep(1);
            }
        }
        
        this.drawWaterfall(this.currentRow + 1);
        this.drawSpectrum(this.currentRow);
        this.updateProgress(100);
        
        this.isRunning = false;
        return !this.stopRequested;
    }
    
    stop() {
        this.stopRequested = true;
    }
    
    clear() {
        this.spectrogram = null;
        this.freqs = null;
        this.currentRow = 0;
        this.waterfallCtx.fillStyle = '#000';
        this.waterfallCtx.fillRect(0, 0, this.waterfallCanvas.width, this.waterfallCanvas.height);
        this.spectrumCtx.fillStyle = '#0a0a1a';
        this.spectrumCtx.fillRect(0, 0, this.spectrumDisplayWidth, this.spectrumHeight);
    }
    
    drawWaterfall(rowCount) {
        if (!this.spectrogram || rowCount === 0) return;
        
        const vmin = parseFloat(document.getElementById('vmin').value);
        const vmax = parseFloat(document.getElementById('vmax').value);
        const range = vmax - vmin;
        
        const bins = this.spectrogram[0].length;
        const ctx = this.waterfallCtx;
        
        // Use actual canvas pixel dimensions (not CSS dimensions)
        const imgWidth = this.waterfallCanvas.width;
        const imgHeight = this.waterfallCanvas.height;
        const imageData = ctx.createImageData(imgWidth, imgHeight);
        const data = imageData.data;
        
        for (let y = 0; y < imgHeight; y++) {
            const rowIdx = Math.floor(y / imgHeight * rowCount);
            if (rowIdx >= rowCount) continue;
            
            const row = this.spectrogram[rowIdx];
            
            for (let x = 0; x < imgWidth; x++) {
                const binIdx = Math.floor(x / imgWidth * bins);
                const value = row[binIdx];
                const normalized = (value - vmin) / range;
                const [r, g, b] = viridis(normalized);
                
                const idx = (y * imgWidth + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Draw frequency labels (scale for DPR)
        const dpr = this.dpr;
        ctx.save();
        ctx.scale(dpr, dpr);
        
        const width = this.displayWidth;
        const height = this.displayHeight;
        
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, height - 20, width, 20);
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        
        const startFreq = this.freqs[0] / 1e6;
        const stopFreq = this.freqs[this.freqs.length - 1] / 1e6;
        const numLabels = 5;
        for (let i = 0; i <= numLabels; i++) {
            const freq = startFreq + (stopFreq - startFreq) * i / numLabels;
            const x = i / numLabels * width;
            ctx.fillText(freq.toFixed(1), x, height - 5);
        }
        
        ctx.restore();
    }
    
    drawSpectrum(rowIdx) {
        if (!this.spectrogram || rowIdx < 0) return;
        
        const vmin = parseFloat(document.getElementById('vmin').value);
        const vmax = parseFloat(document.getElementById('vmax').value);
        
        const width = this.spectrumDisplayWidth;
        const height = this.spectrumHeight;
        const ctx = this.spectrumCtx;
        const row = this.spectrogram[rowIdx];
        const bins = row.length;
        
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const y = i / 5 * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        for (let i = 1; i < 10; i++) {
            const x = i / 10 * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        ctx.strokeStyle = '#44ff88';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        for (let x = 0; x < width; x++) {
            const binIdx = Math.floor(x / width * bins);
            const value = row[binIdx];
            const y = height - ((value - vmin) / (vmax - vmin)) * height;
            const clampedY = Math.max(0, Math.min(height, y));
            
            if (x === 0) {
                ctx.moveTo(x, clampedY);
            } else {
                ctx.lineTo(x, clampedY);
            }
        }
        ctx.stroke();
        
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        for (let i = 0; i <= 4; i++) {
            const db = vmax - (vmax - vmin) * i / 4;
            const y = i / 4 * height;
            ctx.fillText(db.toFixed(0) + ' dB', 5, y + 12);
        }
        
        ctx.textAlign = 'center';
        const startFreq = this.freqs[0] / 1e6;
        const stopFreq = this.freqs[this.freqs.length - 1] / 1e6;
        for (let i = 0; i <= 5; i++) {
            const freq = startFreq + (stopFreq - startFreq) * i / 5;
            const x = i / 5 * width;
            ctx.fillText(freq.toFixed(1) + ' MHz', x, height - 5);
        }
    }
    
    updateProgress(percent) {
        document.getElementById('progress-fill').style.width = percent + '%';
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    redraw() {
        if (this.spectrogram && this.currentRow >= 0) {
            this.drawWaterfall(this.currentRow + 1);
            this.drawSpectrum(this.currentRow);
        }
    }
}

// ============ UI Controller ============
const analyzer = new SpectrumAnalyzer();

const connectBtn = document.getElementById('connectBtn');
const scanBtn = document.getElementById('scanBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const statusDiv = document.getElementById('status');

function setStatus(msg, isError = false) {
    statusDiv.innerHTML = msg + '<div id="progress-bar"><div id="progress-fill"></div></div>';
    statusDiv.style.borderLeft = isError ? '3px solid #ff4444' : '3px solid #44ff88';
}

// Connect
connectBtn.addEventListener('click', async () => {
    try {
        setStatus('Requesting USB device...');
        await analyzer.connect();
        connectBtn.disabled = true;
        scanBtn.disabled = false;
        setStatus('✅ Connected! Configure parameters and click "Start Scan"');
    } catch (err) {
        setStatus('❌ ' + err.message, true);
        console.error('Connection error:', err);
    }
});

// Start Scan
scanBtn.addEventListener('click', async () => {
    try {
        const startFreq = parseFloat(document.getElementById('startFreq').value) * 1e6;
        const stopFreq = parseFloat(document.getElementById('stopFreq').value) * 1e6;
        const numRows = parseInt(document.getElementById('numRows').value);
        const gain = document.getElementById('gain').value;
        const fftSize = parseInt(document.getElementById('fftSize').value);
        const edgeTrim = parseFloat(document.getElementById('edgeTrim').value);
        
        if (stopFreq <= startFreq) {
            setStatus('❌ Stop frequency must be greater than start frequency', true);
            return;
        }
        
        if (startFreq < 24e6 || stopFreq > 1700e6) {
            setStatus('❌ Frequency must be between 24 and 1700 MHz', true);
            return;
        }
        
        scanBtn.disabled = true;
        stopBtn.disabled = false;
        setStatus('🔄 Scanning...');
        
        const completed = await analyzer.scan(startFreq, stopFreq, numRows, gain, fftSize, edgeTrim);
        
        scanBtn.disabled = false;
        stopBtn.disabled = true;
        setStatus(completed ? '✅ Scan complete!' : '⏹️ Scan stopped');
        
    } catch (err) {
        setStatus('❌ ' + err.message, true);
        console.error('Scan error:', err);
        scanBtn.disabled = false;
        stopBtn.disabled = true;
    }
});

// Stop
stopBtn.addEventListener('click', () => {
    analyzer.stop();
    setStatus('Stopping...');
});

// Clear
clearBtn.addEventListener('click', () => {
    analyzer.clear();
    document.getElementById('infoBW').textContent = '-';
    document.getElementById('infoChunks').textContent = '-';
    document.getElementById('infoRes').textContent = '-';
    document.getElementById('infoBins').textContent = '-';
    analyzer.updateProgress(0);
    setStatus('Cleared');
});

// Color scale changes
document.getElementById('vmin').addEventListener('change', () => {
    analyzer.redraw();
    drawColorbar(document.getElementById('colorbar'));
});
document.getElementById('vmax').addEventListener('change', () => {
    analyzer.redraw();
    drawColorbar(document.getElementById('colorbar'));
});

// Window resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        analyzer.initCanvases();
        analyzer.redraw();
        drawColorbar(document.getElementById('colorbar'));
    }, 250);
});

// Initial colorbar
drawColorbar(document.getElementById('colorbar'));

// Service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Check WebUSB support
if (!navigator.usb) {
    setStatus('❌ WebUSB not supported. Use Chrome/Edge on desktop or Android.', true);
    connectBtn.disabled = true;
} else {
    setStatus('Ready. Click "Connect SDR" to begin.');
}
