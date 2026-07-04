import { FilterPreset } from '../types';

/**
 * Synthesizes a tactile, high-fidelity camera shutter sound using Web Audio API.
 * This ensures low latency and offline-first performance without requiring heavy MP3 assets.
 */
export function playShutterSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Part 1: Mechanical Mirror Action (low-to-mid sweep)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(450, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
    
    gain1.gain.setValueAtTime(0.4, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Part 2: Shutter Curtain Slicing Noise (high frequency snap)
    const bufferSize = ctx.sampleRate * 0.04; // 40ms duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const bandpassFilter = ctx.createBiquadFilter();
    bandpassFilter.type = 'bandpass';
    bandpassFilter.frequency.value = 3500;
    bandpassFilter.Q.value = 3;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.04);
    
    noiseSource.connect(bandpassFilter);
    bandpassFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    // Start synthesized nodes
    osc1.start();
    osc1.stop(ctx.currentTime + 0.09);
    noiseSource.start();
    noiseSource.stop(ctx.currentTime + 0.05);
  } catch (e) {
    console.warn("Web Audio shutter sound failed to play:", e);
  }
}

/**
 * Generates a seamless, tileable monochromatic high-frequency noise canvas.
 * Repeated as a pattern to overlay realistic film grain onto the photo.
 */
function createNoisePattern(intensity: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imgData = ctx.createImageData(128, 128);
  const data = imgData.data;

  // Generate high-frequency monochromatic grain centered around middle-grey
  for (let i = 0; i < data.length; i += 4) {
    const factor = intensity / 100;
    // Toned noise calculation for authentic vintage grain distribution
    const noiseVal = (Math.random() - 0.5) * 255 * factor * 0.35;
    const grey = Math.max(0, Math.min(255, 128 + noiseVal));
    
    data[i] = grey;     // Red
    data[i+1] = grey;   // Green
    data[i+2] = grey;   // Blue
    data[i+3] = 255;    // Alpha (pattern overlay blend mode handles blending)
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Draws the source video frame onto the target canvas and applies custom filter adjustments:
 * - Strength (scales all parameters relative to baseline defaults)
 * - Contrast & Saturation (via high-performance hardware-accelerated canvas filter context)
 * - Color Temperature (via soft-light amber/blue overlays)
 * - Film Grain (via a custom-generated tileable overlay pattern)
 * - Zoom (crops and scales centered frame proportionally)
 */
export function applyFiltersToCanvas(
  source: HTMLVideoElement | HTMLImageElement,
  preset: FilterPreset,
  canvas: HTMLCanvasElement,
  zoom: number = 1
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Clear previous drawings
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Calculate parameters scaled by the filter's overall strength slider
  const s = preset.strength;
  const temp = preset.colorTemp * s;
  const contrast = 100 + (preset.contrast - 100) * s;
  const saturation = 100 + (preset.saturation - 100) * s;
  const grain = preset.filmGrain * s;

  // 2. Draw base frame using CSS filters in 2D context for maximum efficiency (and center zoom crop if zoom > 1)
  ctx.save();
  ctx.filter = `contrast(${contrast}%) saturate(${saturation}%)`;
  
  if (zoom <= 1) {
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  } else {
    let sWidth = source instanceof HTMLVideoElement ? source.videoWidth : (source as HTMLImageElement).naturalWidth;
    let sHeight = source instanceof HTMLVideoElement ? source.videoHeight : (source as HTMLImageElement).naturalHeight;
    
    // Safety check for initialization
    if (!sWidth) sWidth = canvas.width;
    if (!sHeight) sHeight = canvas.height;
    
    const cropWidth = sWidth / zoom;
    const cropHeight = sHeight / zoom;
    const cropX = (sWidth - cropWidth) / 2;
    const cropY = (sHeight - cropHeight) / 2;
    
    ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  }
  ctx.restore();

  // 3. Apply color temperature tint using soft-light blending
  if (temp !== 0) {
    ctx.save();
    if (temp > 0) {
      // Golden warmth (Amber tint)
      ctx.fillStyle = `rgba(255, 140, 0, ${(temp / 100) * 0.3})`;
    } else {
      // Atmospheric coolness (Deep sky blue tint)
      ctx.fillStyle = `rgba(0, 110, 255, ${(Math.abs(temp) / 100) * 0.3})`;
    }
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // 4. Apply procedural noise tiled pattern for realistic film grain
  if (grain > 0) {
    ctx.save();
    const noiseTile = createNoisePattern(grain);
    const pattern = ctx.createPattern(noiseTile, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      // 'overlay' blend mode perfectly injects grain into midtones, sparing deep highlights/shadows
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.restore();
  }
}
