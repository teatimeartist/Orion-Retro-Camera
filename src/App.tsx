import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, RotateCw, Sliders, Plus, Download, Trash2, 
  Check, X, Sparkles, Info, Upload, Image as ImageIcon, 
  HelpCircle, Monitor, Smartphone, ChevronRight, SlidersHorizontal, Eye,
  Zap, ZapOff, Maximize, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FilterPreset, CameraProfile } from './types';
import { DEFAULT_PRESETS } from './data/defaultPresets';
import { DEFAULT_CAMERAS } from './data/cameras';
import { playShutterSound, applyFiltersToCanvas } from './utils/cameraUtils';

interface CapturedPhoto {
  id: string;
  url: string;
  timestamp: string;
  presetName: string;
  presetConfig: {
    strength: number;
    colorTemp: number;
    contrast: number;
    saturation: number;
    filmGrain: number;
  };
  width: number;
  height: number;
}

const STOCK_SCENES = [
  { 
    id: 'retro-car', 
    name: 'Vintage Coupe', 
    url: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=800&q=80' 
  },
  { 
    id: 'portrait', 
    name: 'Model Portrait', 
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80' 
  },
  { 
    id: 'cityscape', 
    name: 'Golden Hour Street', 
    url: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80' 
  }
];

const RESOLUTIONS = [
  { width: 640, height: 480, label: 'SD' },
  { width: 1280, height: 720, label: 'HD' },
  { width: 1920, height: 1080, label: 'FHD' },
  { width: 3840, height: 2160, label: '4K' },
];

export default function App() {
  // Loading & View States
  const [isLoading, setIsLoading] = useState(true);
  const [activeCamera, setActiveCamera] = useState<CameraProfile | null>(null);

  // Cameras State (Includes Default Brands & User Created Cameras)
  const [cameras, setCameras] = useState<CameraProfile[]>(() => {
    const stored = localStorage.getItem('custom_retro_cameras');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const customMapped = parsed.map((c: any) => ({ ...c, isCustom: true }));
        return [...DEFAULT_CAMERAS, ...customMapped];
      } catch (e) {
        return DEFAULT_CAMERAS;
      }
    }
    return DEFAULT_CAMERAS;
  });

  // Modal & form states for creating a custom camera
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [newCameraName, setNewCameraName] = useState('');
  const [newCameraImgUrl, setNewCameraImgUrl] = useState('');
  
  // Custom camera default sensor calibration
  const [newCamStrength, setNewCamStrength] = useState(0.85);
  const [newCamColorTemp, setNewCamColorTemp] = useState(20);
  const [newCamContrast, setNewCamContrast] = useState(115);
  const [newCamSaturation, setNewCamSaturation] = useState(105);
  const [newCamFilmGrain, setNewCamFilmGrain] = useState(30);

  // Extra camera features
  const [zoom, setZoom] = useState<number>(1);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [resolution, setResolution] = useState(RESOLUTIONS[2]); // FHD by default

  // Legacy presets compatibility (we will keep presets active for general fallback if needed, but focus primarily on cameras)
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    const stored = localStorage.getItem('custom_camera_presets');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const mapped = parsed.map((p: any) => ({ ...p, isCustom: true }));
        return [...DEFAULT_PRESETS, ...mapped];
      } catch (e) {
        return DEFAULT_PRESETS;
      }
    }
    return DEFAULT_PRESETS;
  });

  const [selectedPreset, setSelectedPreset] = useState<FilterPreset>(DEFAULT_PRESETS[1]); // Default to 'Classic Film'
  
  // Slider states for live viewfinder rendering (synchronized when choosing cameras)
  const [strength, setStrength] = useState(0.85);
  const [colorTemp, setColorTemp] = useState(35);
  const [contrast, setContrast] = useState(115);
  const [saturation, setSaturation] = useState(90);
  const [filmGrain, setFilmGrain] = useState(40);

  // Sync sliders when preset changes
  const applyPresetValues = (preset: FilterPreset) => {
    setSelectedPreset(preset);
    setStrength(preset.strength);
    setColorTemp(preset.colorTemp);
    setContrast(preset.contrast);
    setSaturation(preset.saturation);
    setFilmGrain(preset.filmGrain);
  };

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [useWebcam, setUseWebcam] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);

  // Demo / Custom image fallbacks
  const [activeStockIndex, setActiveStockIndex] = useState(0);
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live noise grain background tile URL
  const [liveGrainUrl, setLiveGrainUrl] = useState<string>('');

  // Interface States
  const [showSliders, setShowSliders] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [flash, setFlash] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<CapturedPhoto | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [currentTime, setCurrentTime] = useState('12:00');
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  // Generate a live tileable grain texture on load & trigger loading screen timer
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(128, 128);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 85;
        const v = Math.max(0, Math.min(255, 128 + noise));
        data[i] = v;
        data[i+1] = v;
        data[i+2] = v;
        data[i+3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      setLiveGrainUrl(canvas.toDataURL());
    }

    // Loading screen timer
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  // Update mock phone clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Stream Initialization
  const initCamera = async () => {
    if (!useWebcam) return;
    
    // Stop any existing tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraError(null);

    const constraints = {
      audio: false,
      video: {
        facingMode: facingMode,
        width: { ideal: resolution.width },
        height: { ideal: resolution.height }
      }
    };

    try {
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      
      // Enumerate other potential cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setAvailableCameras(videoDevices);
    } catch (err: any) {
      console.warn("Camera request error:", err);
      setCameraError("Webcam permissions denied or unavailable. Fallback scene mode activated.");
      setUseWebcam(false);
    }
  };

  useEffect(() => {
    if (activeCamera && useWebcam) {
      initCamera();
    } else {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [facingMode, useWebcam, resolution, activeCamera]);

  // Flip rear / front camera
  const handleToggleCameraFacing = () => {
    setUseWebcam(true);
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Check if current sliders deviate from the selected camera default preset values
  const isPresetModified = () => {
    if (!activeCamera) return false;
    return (
      strength !== activeCamera.defaultPreset.strength ||
      colorTemp !== activeCamera.defaultPreset.colorTemp ||
      contrast !== activeCamera.defaultPreset.contrast ||
      saturation !== activeCamera.defaultPreset.saturation ||
      filmGrain !== activeCamera.defaultPreset.filmGrain
    );
  };

  // Shutter action
  const handleCapture = () => {
    playShutterSound();
    
    // Trigger shutter screen flash
    setFlash(true);
    // If flash mode is 'on' or 'auto', we make the screen white overlay brighter and longer (simulated fill light)
    const flashDuration = (flashMode === 'on' || flashMode === 'auto') ? 350 : 160;
    setTimeout(() => setFlash(false), flashDuration);

    // Momentary hardware torch flash if flashMode is 'on' or 'auto'
    if (stream && (flashMode === 'on' || flashMode === 'auto')) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = track.getCapabilities() as any;
          if (capabilities && capabilities.torch) {
            track.applyConstraints({
              advanced: [{ torch: true } as any]
            } as any);
            setTimeout(() => {
              track.applyConstraints({
                advanced: [{ torch: false } as any]
              } as any);
            }, 400);
          }
        } catch (e) {
          console.warn("Hardware torch failed to fire:", e);
        }
      }
    }

    let sourceEl: HTMLVideoElement | HTMLImageElement | null = null;
    
    // Set output dimensions according to the user's selected resolution setting
    let width = resolution.width;
    let height = resolution.height;

    if (useWebcam && videoRef.current && stream) {
      sourceEl = videoRef.current;
      const videoWidth = videoRef.current.videoWidth || resolution.width;
      const videoHeight = videoRef.current.videoHeight || resolution.height;
      width = resolution.width;
      height = Math.round(resolution.width * (videoHeight / videoWidth)) || resolution.height;
    } else if (customImageSrc && imgRef.current) {
      sourceEl = imgRef.current;
      const imgWidth = imgRef.current.naturalWidth || resolution.width;
      const imgHeight = imgRef.current.naturalHeight || resolution.height;
      width = resolution.width;
      height = Math.round(resolution.width * (imgHeight / imgWidth)) || resolution.height;
    } else if (imgRef.current) {
      sourceEl = imgRef.current;
      const imgWidth = imgRef.current.naturalWidth || resolution.width;
      const imgHeight = imgRef.current.naturalHeight || resolution.height;
      width = resolution.width;
      height = Math.round(resolution.width * (imgHeight / imgWidth)) || resolution.height;
    }

    if (!sourceEl) return;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const currentPreset: FilterPreset = {
      id: 'active_render',
      name: 'Render',
      strength,
      colorTemp,
      contrast,
      saturation,
      filmGrain
    };

    // Render with digital zoom crop
    applyFiltersToCanvas(sourceEl, currentPreset, canvas, zoom);

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      const cameraLabel = activeCamera 
        ? (isPresetModified() ? `${activeCamera.name} (Tuned)` : activeCamera.name)
        : 'RetroCam';

      const newPhoto: CapturedPhoto = {
        id: `img_${Date.now()}`,
        url: dataUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        presetName: cameraLabel,
        presetConfig: { strength, colorTemp, contrast, saturation, filmGrain },
        width,
        height
      };

      setPhotos(prev => [newPhoto, ...prev]);

      // Automatically trigger download as requested: "saves them into my gallery"
      const link = document.createElement('a');
      link.download = `RetroCam_${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Canvas export failed:", e);
    }
  };

  // Screen Click/Focus Animation
  const handleViewfinderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusPoint({ x, y });

    // Play tactile mechanical audio beep
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.13);
      }
    } catch (err) {}

    setTimeout(() => {
      setFocusPoint(null);
    }, 900);
  };

  // Create and persist a user custom camera model with default calibrated filters
  const handleCreateCustomCamera = () => {
    if (!newCameraName.trim()) return;

    const newCam: CameraProfile = {
      id: `camera_${Date.now()}`,
      name: newCameraName.trim(),
      imageUrl: newCameraImgUrl.trim() || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80',
      defaultPreset: {
        id: `preset_${Date.now()}`,
        name: `${newCameraName.trim()} Default`,
        strength: newCamStrength,
        colorTemp: newCamColorTemp,
        contrast: newCamContrast,
        saturation: newCamSaturation,
        filmGrain: newCamFilmGrain,
        isCustom: true
      },
      isCustom: true
    };

    const updatedCameras = [...cameras, newCam];
    setCameras(updatedCameras);

    // Filter only custom cameras for offline localStorage storage
    const customOnly = updatedCameras.filter(c => c.isCustom);
    localStorage.setItem('custom_retro_cameras', JSON.stringify(customOnly));

    // Select the newly assembled camera immediately to try it out!
    setActiveCamera(newCam);
    setStrength(newCamStrength);
    setColorTemp(newCamColorTemp);
    setContrast(newCamContrast);
    setSaturation(newCamSaturation);
    setFilmGrain(newCamFilmGrain);

    // Reset wizard fields
    setNewCameraName('');
    setNewCameraImgUrl('');
    setNewCamStrength(0.85);
    setNewCamColorTemp(20);
    setNewCamContrast(115);
    setNewCamSaturation(105);
    setNewCamFilmGrain(30);
    setShowAddCameraModal(false);
  };

  // Remove custom camera profile
  const handleDeleteCustomCamera = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = cameras.filter(c => c.id !== id);
    setCameras(updated);

    const customOnly = updated.filter(c => c.isCustom);
    localStorage.setItem('custom_retro_cameras', JSON.stringify(customOnly));

    if (activeCamera && activeCamera.id === id) {
      setActiveCamera(null);
    }
  };

  // Restores original sensor calibration parameters for the selected camera model
  const handleResetToCameraDefaults = () => {
    if (!activeCamera) return;
    setStrength(activeCamera.defaultPreset.strength);
    setColorTemp(activeCamera.defaultPreset.colorTemp);
    setContrast(activeCamera.defaultPreset.contrast);
    setSaturation(activeCamera.defaultPreset.saturation);
    setFilmGrain(activeCamera.defaultPreset.filmGrain);
  };

  // Handles retro camera selection from menu rack
  const handleSelectCamera = (camera: CameraProfile) => {
    setActiveCamera(camera);
    setStrength(camera.defaultPreset.strength);
    setColorTemp(camera.defaultPreset.colorTemp);
    setContrast(camera.defaultPreset.contrast);
    setSaturation(camera.defaultPreset.saturation);
    setFilmGrain(camera.defaultPreset.filmGrain);
    setShowSliders(false);
  };

  // Trigger file browser for image upload fallback
  const handleTriggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setCustomImageSrc(url);
      setUseWebcam(false);
    }
  };

  // Calculations for live filters on video or image
  const liveContrast = 100 + (contrast - 100) * strength;
  const liveSaturation = 100 + (saturation - 100) * strength;
  const liveTemp = colorTemp * strength;
  const liveGrain = filmGrain * strength;

  // Render appropriate tint color for temperature overlay
  const getLiveTempTint = () => {
    if (liveTemp === 0) return 'rgba(0,0,0,0)';
    if (liveTemp > 0) {
      return `rgba(255, 140, 0, ${(liveTemp / 100) * 0.22})`; // Warm Amber
    } else {
      return `rgba(0, 110, 255, ${(Math.abs(liveTemp) / 100) * 0.22})`; // Cool Sky Blue
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center p-0 md:p-6 selection:bg-orange-500/30 selection:text-orange-400">
      
      {/* Container holding either physical mockup + sidebar on desktop, or fullscreen on mobile */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center justify-center">
        
        {/* Left Side: Editorial Typography & PWA instructions (Hidden on mobile) */}
        <div className="hidden lg:flex lg:col-span-4 flex-col space-y-6 pr-4">
          <div className="space-y-2">
            <span className="text-xs font-mono text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2.5 py-1 rounded-full">RetroCam Pro</span>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-100">Custom Filter Camera</h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              An offline-first aesthetic camera designed to take pictures, apply custom temperature/grain formulas, and instantly download high-resolution outputs directly to your gallery.
            </p>
          </div>

          <div className="bg-neutral-900/60 rounded-2xl p-5 border border-neutral-800/80 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-orange-400" />
              Run on your Android Phone
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              No need for a compiled APK! This app is configured as a high-fidelity **PWA (Progressive Web App)** that operates natively on Android with full system camera hardware:
            </p>
            <ol className="text-xs text-neutral-300 space-y-2 list-decimal list-inside pl-1">
              <li>Open the <span className="text-orange-400 font-medium">Shared App URL</span> on your phone's Chrome browser.</li>
              <li>Tap Chrome's <span className="font-semibold text-neutral-200">Menu (3-dots)</span>.</li>
              <li>Select <span className="text-orange-400 font-semibold">"Add to Home screen"</span> or <span className="text-orange-400 font-semibold">"Install app"</span>.</li>
              <li>Launch from your app drawer. It will run borderless and save photos to your phone gallery like a native app!</li>
            </ol>
          </div>

          <div className="bg-neutral-900/30 rounded-2xl p-4 border border-neutral-800/40 space-y-2">
            <h4 className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
              Creative Controls Guide
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Use **Color Temp** to add warm golden-hour glow or cold cinematic tones. Use **Film Grain** to layer realistic noise. Adjust **Strength** to scale your entire custom preset easily.
            </p>
          </div>
        </div>

        {/* Center/Right Side: The Phone Mockup */}
        <div className="lg:col-span-8 flex justify-center w-full">
          
          {/* Simulated Physical Android Phone Shell */}
          {/* On mobile screens (< 768px), standard utilities strip the frame entirely so it occupies full device viewport */}
          <div className="relative w-full md:w-[410px] md:h-[840px] md:bg-neutral-900 md:border-[12px] md:border-neutral-800 md:rounded-[56px] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col select-none md:ring-4 md:ring-neutral-900/50">
            
            {/* Front Camera Notch Hole (Simulated on desktop frame) */}
            <div className="hidden md:block absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-neutral-950 rounded-full z-50 border border-neutral-800/50 flex items-center justify-center">
              <div className="w-1 h-1 bg-blue-900/80 rounded-full" />
            </div>

            {/* Android Status Bar (Simulated on desktop frame) */}
            <div className="w-full bg-neutral-950 px-6 pt-3 pb-2 flex justify-between items-center text-[11px] font-medium tracking-wide text-neutral-300 z-40 select-none md:pt-4">
              <span>{currentTime}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-neutral-800 px-1 py-0.5 rounded text-orange-400 font-mono tracking-tighter">LTE</span>
                <span className="text-green-500">● 92%</span>
                <div className="w-5 h-2.5 border border-neutral-400 rounded-sm p-0.5 flex items-center">
                  <div className="w-full h-full bg-neutral-200 rounded-2xs" />
                </div>
              </div>
            </div>

            {/* MAIN APP CONTAINER */}
            <div className="flex-1 bg-black flex flex-col relative overflow-hidden">
              
              {activeCamera === null ? (
                // CAMERA SELECTION RACK SCREEN
                <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
                  
                  {/* Top Bar / Header of selection menu */}
                  <div className="px-5 py-4.5 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center">
                    <div>
                      <h2 className="text-sm font-black tracking-widest text-orange-500 uppercase font-mono">ORION CAMERAS</h2>
                      <p className="text-[10px] text-neutral-400 font-medium">SELECT RETRO SYSTEM</p>
                    </div>
                    <button 
                      onClick={() => setShowInfoModal(true)}
                      className="p-1.5 rounded-full bg-neutral-950 border border-neutral-800 hover:border-neutral-700 hover:text-white transition-all text-neutral-400"
                      title="Instructions & Capability Info"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scrollable grid of camera options */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-none pb-20">
                    <div className="grid grid-cols-2 gap-3.5">
                      {cameras.map((cam) => {
                        // Color label tag based on name to match styling
                        let badgeColor = "bg-neutral-800 text-neutral-300";
                        let badgeLabel = "CLASSIC";
                        const camIdLower = cam.id.toLowerCase();
                        if (camIdLower.includes('fuji')) { 
                          badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"; 
                          badgeLabel = "CHROME"; 
                        } else if (camIdLower.includes('hassel')) { 
                          badgeColor = "bg-amber-500/10 text-amber-400 border border-amber-500/20"; 
                          badgeLabel = "MEDIUM FORMAT"; 
                        } else if (camIdLower.includes('nikon')) { 
                          badgeColor = "bg-sky-500/10 text-sky-400 border border-sky-500/20"; 
                          badgeLabel = "CRISP"; 
                        } else if (camIdLower.includes('leica')) { 
                          badgeColor = "bg-neutral-100 text-neutral-950 font-black"; 
                          badgeLabel = "MONO"; 
                        } else if (camIdLower.includes('olympus')) { 
                          badgeColor = "bg-orange-500/10 text-orange-400 border border-orange-500/20"; 
                          badgeLabel = "35MM"; 
                        } else if (camIdLower.includes('pentax') || camIdLower.includes('penta')) { 
                          badgeColor = "bg-rose-500/10 text-rose-400 border border-rose-500/20"; 
                          badgeLabel = "CINEMATIC"; 
                        } else if (cam.isCustom) { 
                          badgeColor = "bg-violet-500/10 text-violet-400 border border-violet-500/20"; 
                          badgeLabel = "CUSTOM"; 
                        }

                        return (
                          <div
                            key={cam.id}
                            onClick={() => handleSelectCamera(cam)}
                            className="bg-neutral-900 border border-neutral-800/80 hover:border-orange-500/40 rounded-2xl overflow-hidden hover:shadow-[0_8px_20px_rgba(0,0,0,0.6)] transition-all duration-300 cursor-pointer flex flex-col group relative"
                          >
                            {/* Card Image */}
                            <div className="relative aspect-[4/3] bg-neutral-950 overflow-hidden">
                              <img 
                                src={cam.imageUrl} 
                                alt={cam.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                referrerPolicy="no-referrer"
                              />
                              
                              {/* Overlay gradient */}
                              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent pointer-events-none" />

                              {/* Emulation Badge Tag */}
                              <span className={`absolute top-2 right-2 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-md ${badgeColor}`}>
                                {badgeLabel}
                              </span>
                            </div>

                            {/* Text details */}
                            <div className="p-3 flex flex-col flex-1 bg-neutral-900/40 border-t border-neutral-950">
                              <h4 className="font-bold text-xs text-neutral-100 group-hover:text-orange-400 transition-colors truncate">
                                {cam.name}
                              </h4>
                              <p className="text-[9px] font-mono text-neutral-500 mt-0.5">
                                {cam.defaultPreset.name}
                              </p>
                            </div>

                            {/* Delete Button for custom cameras */}
                            {cam.isCustom && (
                              <button
                                onClick={(e) => handleDeleteCustomCamera(cam.id, e)}
                                className="absolute top-2 left-2 p-1 rounded-md bg-neutral-950/80 hover:bg-red-950 hover:text-red-400 border border-neutral-800 text-neutral-400 transition-all z-10 active:scale-90"
                                title="Delete Custom Camera"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* "+" Add Custom Camera Tile */}
                      <div
                        onClick={() => setShowAddCameraModal(true)}
                        className="bg-neutral-950/40 border-2 border-dashed border-neutral-800 hover:border-orange-500/40 hover:bg-neutral-900/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer aspect-square min-h-[145px] group"
                      >
                        <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center mb-2 border border-neutral-800 group-hover:border-orange-500/40 transition-colors">
                          <Plus className="w-5 h-5 text-neutral-400" />
                        </div>
                        <span className="text-xs font-bold text-neutral-200 block">Assemble Camera</span>
                        <span className="text-[9px] font-mono text-neutral-500 mt-1 uppercase">Custom Sensor</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // VIEWFINDER AND SHOOTING CONTROLS FOR THE ACTIVE RETRO CAMERA
                <div className="flex-1 flex flex-col relative overflow-hidden">
                  
                  {/* VIEWFINDER CANVAS/VIDEO BLOCK */}
                  <div 
                    id="viewfinder"
                    className="relative aspect-[3/4] md:aspect-auto md:flex-1 bg-neutral-900 overflow-hidden cursor-crosshair group"
                    onClick={handleViewfinderClick}
                  >
                    {/* Top Utility Bar inside Viewfinder */}
                    <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveCamera(null); }}
                          className="px-2.5 py-1.5 rounded-full bg-neutral-950/80 backdrop-blur-md border border-neutral-800/60 hover:bg-neutral-900 text-[10px] font-bold text-neutral-200 flex items-center gap-1 active:scale-95 transition-all shadow-lg"
                        >
                          <ArrowLeft className="w-3 h-3 text-orange-500" />
                          Cameras
                        </button>

                        <span className="text-[9px] bg-neutral-950/80 border border-neutral-800/60 px-2.5 py-1.5 rounded-full text-orange-400 font-mono flex items-center gap-1 font-semibold uppercase tracking-wider backdrop-blur-md shadow-lg">
                          {activeCamera.name}
                        </span>
                      </div>

                      <div className="flex gap-1.5 items-center">
                        {/* Resolution Switcher (FHD, HD, SD, 4K) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const idx = RESOLUTIONS.findIndex(r => r.label === resolution.label);
                            const nextIdx = (idx + 1) % RESOLUTIONS.length;
                            setResolution(RESOLUTIONS[nextIdx]);
                          }}
                          className="px-2.5 py-1.5 rounded-full bg-neutral-950/80 backdrop-blur-md border border-neutral-800/60 hover:bg-neutral-900 text-[10px] font-bold font-mono text-neutral-200 flex items-center gap-1 active:scale-95 transition-all shadow-lg"
                          title={`Output Resolution: ${resolution.width}x${resolution.height}`}
                        >
                          <Maximize className="w-3 h-3 text-neutral-400" />
                          {resolution.label}
                        </button>

                        <button 
                          onClick={(e) => { e.stopPropagation(); handleToggleCameraFacing(); }}
                          className={`p-1.5 rounded-full bg-neutral-950/80 backdrop-blur-md border border-neutral-800/60 hover:bg-neutral-900 active:rotate-180 transition-all duration-300 shadow-lg ${!useWebcam ? 'opacity-40' : ''}`}
                          disabled={!useWebcam}
                          title="Flip Camera"
                        >
                          <RotateCw className="w-4 h-4 text-neutral-300" />
                        </button>
                      </div>
                    </div>

                    {/* Floating Quick Zoom Selector (1x, 2x, 3x, 5x) */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-neutral-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-neutral-800/60 shadow-lg">
                      {[1, 2, 3, 5].map((z) => {
                        const isSel = zoom === z;
                        return (
                          <button
                            key={z}
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoom(z);
                            }}
                            className={`w-7 h-7 rounded-full text-[10px] font-bold font-mono transition-all flex items-center justify-center ${
                              isSel 
                                ? 'bg-orange-500 text-white shadow-md scale-110' 
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
                            }`}
                          >
                            {z}x
                          </button>
                        );
                      })}
                    </div>

                    {/* Camera View / Video Element */}
                    {useWebcam ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover select-none pointer-events-none transition-all duration-200"
                        style={{
                          transform: facingMode === 'user' ? `scaleX(-1) scale(${zoom})` : `scale(${zoom})`,
                          transformOrigin: 'center center',
                          filter: `contrast(${liveContrast}%) saturate(${liveSaturation}%)`
                        }}
                      />
                    ) : (
                      // Fallback Scenic View (Render beautiful landscape/portrait images when webcam offline)
                      <img
                        ref={imgRef}
                        src={customImageSrc || STOCK_SCENES[activeStockIndex].url}
                        alt="Simulated Viewfinder Scene"
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover select-none pointer-events-none transition-all duration-200"
                        style={{
                          transform: `scale(${zoom})`,
                          transformOrigin: 'center center',
                          filter: `contrast(${liveContrast}%) saturate(${liveSaturation}%)`
                        }}
                      />
                    )}

                    {/* Live Temperature Color Grading Overlay */}
                    <div 
                      className="absolute inset-0 pointer-events-none transition-colors duration-100"
                      style={{ 
                        backgroundColor: getLiveTempTint(),
                        mixBlendMode: 'soft-light'
                      }}
                    />

                    {/* Live Film Grain Layer (Simulated high-frequency overlay) */}
                    {liveGrain > 0 && (
                      <div 
                        className="absolute inset-0 pointer-events-none mix-blend-overlay"
                        style={{
                          backgroundImage: `url(${liveGrainUrl})`,
                          backgroundSize: '128px 128px',
                          opacity: (liveGrain / 100) * 0.45
                        }}
                      />
                    )}

                    {/* Focus Square Target Bracket */}
                    <AnimatePresence>
                      {focusPoint && (
                        <motion.div 
                          initial={{ scale: 1.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute w-14 h-14 border border-yellow-400 pointer-events-none flex items-center justify-center"
                          style={{ top: focusPoint.y - 28, left: focusPoint.x - 28 }}
                        >
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-yellow-400" />
                          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-yellow-400" />
                          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-yellow-400" />
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-yellow-400" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Screen Camera Shutter Flash Animation overlay */}
                    <AnimatePresence>
                      {flash && (
                        <motion.div 
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 0 }}
                          className="absolute inset-0 bg-white z-30 pointer-events-none"
                        />
                      )}
                    </AnimatePresence>

                    {/* Mode Indicator Overlay */}
                    <div className="absolute bottom-3 left-3 pointer-events-none z-20 flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider bg-black/70 backdrop-blur-md border border-neutral-800 text-neutral-300 px-2 py-0.5 rounded-md font-mono shadow-md">
                        {useWebcam ? 'LIVE SENSOR' : 'DEMO FALLBACK'}
                      </span>
                    </div>

                    {/* Camera Fallback Control triggers */}
                    {!useWebcam && (
                      <div className="absolute bottom-3 right-3 z-20 flex gap-1.5">
                        {STOCK_SCENES.map((scene, idx) => (
                          <button
                            key={scene.id}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setCustomImageSrc(null);
                              setActiveStockIndex(idx); 
                            }}
                            className={`text-[9px] font-semibold px-2 py-1 rounded transition-all backdrop-blur-md ${
                              activeStockIndex === idx && !customImageSrc
                                ? 'bg-orange-500 text-white shadow-md' 
                                : 'bg-black/75 hover:bg-black/90 text-neutral-400 shadow-md'
                            }`}
                          >
                            {scene.name.split(' ')[0]}
                          </button>
                        ))}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTriggerUpload(); }}
                          className={`text-[9px] font-semibold px-2 py-1 rounded transition-all backdrop-blur-md flex items-center gap-1 ${
                            customImageSrc 
                              ? 'bg-green-600 text-white shadow-md' 
                              : 'bg-neutral-800/90 text-neutral-300 hover:bg-neutral-800 shadow-md'
                          }`}
                        >
                          <Upload className="w-2.5 h-2.5" /> File
                        </button>
                      </div>
                    )}
                  </div>

                  {/* HIDDEN FILE UPLOADER FOR SCENE FALLBACK */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />

                  {/* CONTROLS: PRESET SLIDERS SLIDE-UP DRAWER */}
                  <AnimatePresence>
                    {showSliders && (
                      <motion.div 
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="absolute bottom-[170px] left-0 right-0 bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-800 p-5 z-30 flex flex-col space-y-4 max-h-[290px] overflow-y-auto"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-neutral-900">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider font-mono">SENSOR CALIBRATION</span>
                            {isPresetModified() && (
                              <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono">Customized</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {isPresetModified() && (
                              <button
                                onClick={handleResetToCameraDefaults}
                                className="text-[10px] text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-md transition-all active:scale-95"
                              >
                                Reset Factory Look
                              </button>
                            )}
                            <button 
                              onClick={() => setShowSliders(false)}
                              className="p-1 text-neutral-400 hover:text-white"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* SLIDERS BODY */}
                        <div className="space-y-3">
                          
                          {/* Strength (Effect Scaling) */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-400 font-medium">Filter Strength</span>
                              <span className="text-white font-mono font-bold">{Math.round(strength * 100)}%</span>
                            </div>
                            <input 
                              type="range" min="0" max="1" step="0.05"
                              value={strength}
                              onChange={(e) => setStrength(parseFloat(e.target.value))}
                              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                          </div>

                          {/* Color Temp Slider (-100 to 100) */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-400 font-medium flex items-center gap-1">Color Temperature</span>
                              <span className={`font-mono font-bold ${colorTemp > 0 ? 'text-amber-400' : colorTemp < 0 ? 'text-blue-400' : 'text-neutral-400'}`}>
                                {colorTemp > 0 ? `+${colorTemp} (Warm)` : colorTemp < 0 ? `${colorTemp} (Cool)` : '0 (Neutral)'}
                              </span>
                            </div>
                            <input 
                              type="range" min="-100" max="100" step="2"
                              value={colorTemp}
                              onChange={(e) => setColorTemp(parseInt(e.target.value))}
                              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                          </div>

                          {/* Contrast Slider (50 to 150) */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-400 font-medium">Contrast Balance</span>
                              <span className="text-white font-mono font-bold">{contrast}%</span>
                            </div>
                            <input 
                              type="range" min="50" max="150" step="1"
                              value={contrast}
                              onChange={(e) => setContrast(parseInt(e.target.value))}
                              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-300"
                            />
                          </div>

                          {/* Saturation Slider (0 to 200) */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-400 font-medium">Color Saturation</span>
                              <span className="text-white font-mono font-bold">{saturation}%</span>
                            </div>
                            <input 
                              type="range" min="0" max="200" step="2"
                              value={saturation}
                              onChange={(e) => setSaturation(parseInt(e.target.value))}
                              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            />
                          </div>

                          {/* Film Grain Slider (0 to 100) */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-400 font-medium flex items-center gap-1">Analog Film Grain</span>
                              <span className="text-orange-300 font-mono font-bold">{filmGrain} ISO</span>
                            </div>
                            <input 
                              type="range" min="0" max="100" step="1"
                              value={filmGrain}
                              onChange={(e) => setFilmGrain(parseInt(e.target.value))}
                              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-400"
                            />
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* MINI INDICATOR STATUS BAR (In place of preset list bottom bar) */}
                  <div className="bg-neutral-950/95 border-t border-neutral-900 py-3 px-4 z-20 flex justify-between items-center text-[10px] text-neutral-400 font-mono">
                    <div className="flex items-center gap-1 truncate max-w-[60%]">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                      <span className="truncate">{activeCamera.name.toUpperCase()} ACTIVE</span>
                    </div>
                    <div className="text-neutral-500 font-bold text-[9px] shrink-0">
                      {isPresetModified() ? "MODIFIED TONE" : "FACTORY STATE"}
                    </div>
                  </div>

                  {/* PRIMARY SHUTTER BOTTOM DRAWER / TRIGGER PANELS */}
                  <div className="bg-neutral-950 px-6 py-5 border-t border-neutral-900 flex items-center justify-between z-20">
                    
                    {/* FLASH QUICK CYCLE BUTTON (Lower Left) */}
                    <div className="w-12 flex justify-start">
                      <button
                        onClick={() => {
                          setFlashMode(prev => {
                            if (prev === 'off') return 'auto';
                            if (prev === 'auto') return 'on';
                            return 'off';
                          });
                        }}
                        className={`p-3 rounded-full border transition-all active:scale-90 ${
                          flashMode !== 'off'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                            : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                        title={`Flash Mode: ${flashMode.toUpperCase()}`}
                      >
                        {flashMode === 'off' ? (
                          <ZapOff className="w-4 h-4" />
                        ) : (
                          <div className="relative">
                            <Zap className="w-4 h-4" />
                            {flashMode === 'auto' && (
                              <span className="absolute -top-1 -right-1 text-[8px] font-black font-mono bg-amber-500 text-neutral-950 px-1 rounded leading-none">A</span>
                            )}
                          </div>
                        )}
                      </button>
                    </div>

                    {/* SHUTTER BUTTON (Center) */}
                    <div className="relative">
                      <button
                        onClick={handleCapture}
                        className="group relative flex items-center justify-center p-1 focus:outline-none"
                      >
                        <span className="absolute inset-0 rounded-full border-4 border-neutral-800 scale-100 group-hover:scale-105 transition-all duration-300" />
                        <span className="absolute inset-1.5 rounded-full border border-orange-500/10 scale-100" />
                        
                        <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 group-hover:bg-white relative">
                          <div className="w-11 h-11 rounded-full border-2 border-neutral-950 flex items-center justify-center">
                            <Camera className="w-4 h-4 text-neutral-900" />
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* SLIDERS DRAWER TRIGGER BUTTON (Lower Right) */}
                    <div className="w-12 flex justify-end">
                      <button
                        onClick={() => setShowSliders(!showSliders)}
                        className={`p-3 rounded-full border transition-all active:scale-90 ${
                          showSliders || isPresetModified()
                            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' 
                            : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                        title="Toggle Sensor Parameters"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>
                    </div>

                  </div>

                </div>
              )}

            </div>

            {/* Simulated Android Gestures System Bar */}
            <div className="w-full bg-neutral-950 py-2.5 flex justify-center items-center z-40 select-none border-t border-neutral-900/10">
              <div className="w-28 h-1 bg-neutral-600 rounded-full" />
            </div>

          </div>

        </div>

      </div>

      {/* MODAL 1: ASSEMBLE CUSTOM RETRO CAMERA WIZARD */}
      <AnimatePresence>
        {showAddCameraModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-md my-8 space-y-4 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                <h3 className="text-sm font-black tracking-wider uppercase text-neutral-100 flex items-center gap-1.5 font-mono">
                  <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                  Assemble Custom Camera
                </h3>
                <button onClick={() => setShowAddCameraModal(false)} className="text-neutral-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                <p className="text-xs text-neutral-400 leading-normal">
                  Customize a new camera simulation. Give it a name, select a camera body thumbnail, and tune its signature filter emulsion calibration parameters.
                </p>

                {/* 1. NAME */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-orange-400 font-bold">Camera Model Name</label>
                  <input
                    type="text"
                    value={newCameraName}
                    onChange={(e) => setNewCameraName(e.target.value)}
                    placeholder="e.g. Yashica Electro 35"
                    maxLength={24}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 placeholder:text-neutral-600"
                    autoFocus
                  />
                </div>

                {/* 2. CHOOSE CAMERA LOOK */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-orange-400 font-bold block">Select Camera Housing Thumbnail</label>
                  
                  {/* Pre-curated looks */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'Rangefinder', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=300&q=80' },
                      { name: 'TLR Vintage', url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=300&q=80' },
                      { name: 'SLR Leather', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80' },
                      { name: 'Point-Shoot', url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=300&q=80' },
                    ].map((look) => {
                      const isSel = newCameraImgUrl === look.url;
                      return (
                        <button
                          key={look.name}
                          type="button"
                          onClick={() => setNewCameraImgUrl(look.url)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${isSel ? 'border-orange-500 scale-95 shadow-md' : 'border-neutral-800 hover:border-neutral-600'}`}
                        >
                          <img src={look.url} alt={look.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/80 py-0.5 text-[7px] text-center text-neutral-300 font-mono truncate">
                            {look.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1">
                    <input
                      type="text"
                      value={newCameraImgUrl}
                      onChange={(e) => setNewCameraImgUrl(e.target.value)}
                      placeholder="Or paste external Unsplash camera image URL..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-[11px] text-white focus:outline-none focus:border-orange-500 placeholder:text-neutral-600"
                    />
                  </div>
                </div>

                {/* 3. CALIBRATION SLIDERS */}
                <div className="space-y-2.5 bg-neutral-950/80 rounded-2xl p-3 border border-neutral-800/60">
                  <h4 className="text-[10px] font-mono uppercase text-neutral-300 font-bold border-b border-neutral-900 pb-1.5 flex justify-between">
                    <span>EMULSION CALIBRATION</span>
                    <span className="text-orange-400">SIGNATURE EFFECT</span>
                  </h4>

                  {/* Strength */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-neutral-400">Filter Strength</span>
                      <span className="text-white font-bold">{Math.round(newCamStrength * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" value={newCamStrength}
                      onChange={(e) => setNewCamStrength(parseFloat(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>

                  {/* Temperature */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-neutral-400">Color Temperature</span>
                      <span className="text-white font-bold">{newCamColorTemp > 0 ? `+${newCamColorTemp}K` : `${newCamColorTemp}K`}</span>
                    </div>
                    <input 
                      type="range" min="-80" max="80" step="2" value={newCamColorTemp}
                      onChange={(e) => setNewCamColorTemp(parseInt(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-neutral-400">Contrast Balance</span>
                      <span className="text-white font-bold">{newCamContrast}%</span>
                    </div>
                    <input 
                      type="range" min="60" max="140" step="1" value={newCamContrast}
                      onChange={(e) => setNewCamContrast(parseInt(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-neutral-300"
                    />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-neutral-400">Color Saturation</span>
                      <span className="text-white font-bold">{newCamSaturation}%</span>
                    </div>
                    <input 
                      type="range" min="30" max="170" step="1" value={newCamSaturation}
                      onChange={(e) => setNewCamSaturation(parseInt(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-rose-500"
                    />
                  </div>

                  {/* Film Grain */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-neutral-400">Analog Film Grain</span>
                      <span className="text-orange-300 font-bold">{newCamFilmGrain} ISO</span>
                    </div>
                    <input 
                      type="range" min="0" max="80" step="1" value={newCamFilmGrain}
                      onChange={(e) => setNewCamFilmGrain(parseInt(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-orange-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setShowAddCameraModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-xs text-neutral-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCustomCamera}
                  disabled={!newCameraName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-xs text-white font-bold shadow-lg"
                >
                  Complete Assembly
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: LIGHTBOX PHOTO REVIEW GALLERY */}
      <AnimatePresence>
        {activeLightboxPhoto && (
          <div className="fixed inset-0 z-50 flex flex-col justify-between p-4 bg-neutral-950/98 backdrop-blur-md">
            
            {/* Top Bar controls */}
            <div className="flex justify-between items-center py-2 px-1 max-w-xl mx-auto w-full">
              <div className="flex flex-col">
                <span className="text-xs text-neutral-400">Captured Picture</span>
                <span className="text-[10px] font-mono text-orange-400 font-semibold uppercase">{activeLightboxPhoto.presetName}</span>
              </div>
              <button 
                onClick={() => setActiveLightboxPhoto(null)}
                className="p-2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mid Main Display */}
            <div className="flex-1 flex items-center justify-center p-2 max-w-xl mx-auto w-full">
              <div className="relative border border-neutral-900 rounded-2xl overflow-hidden bg-black shadow-2xl max-h-[72vh]">
                <img 
                  src={activeLightboxPhoto.url} 
                  alt="High quality export" 
                  className="max-h-[70vh] w-auto object-contain mx-auto"
                />
              </div>
            </div>

            {/* Bottom Controls / Info */}
            <div className="max-w-xl mx-auto w-full space-y-4 pb-6 pt-2">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-neutral-500 text-[10px] uppercase font-mono block">Metadata Details</span>
                  <p className="text-neutral-300 font-mono text-[11px]">{activeLightboxPhoto.width} × {activeLightboxPhoto.height} px</p>
                  <p className="text-neutral-500 text-[10px]">{activeLightboxPhoto.timestamp} • Jpeg Format</p>
                </div>
                <div className="space-y-1">
                  <span className="text-neutral-500 text-[10px] uppercase font-mono block">Preset Parameters</span>
                  <p className="text-neutral-300 font-mono text-[10px] leading-relaxed">
                    S: {Math.round(activeLightboxPhoto.presetConfig.strength * 100)}% | T: {activeLightboxPhoto.presetConfig.colorTemp} | C: {activeLightboxPhoto.presetConfig.contrast}% | Sat: {activeLightboxPhoto.presetConfig.saturation}% | G: {activeLightboxPhoto.presetConfig.filmGrain}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                {/* Delete Picture option */}
                <button
                  onClick={() => {
                    setPhotos(prev => prev.filter(p => p.id !== activeLightboxPhoto.id));
                    setActiveLightboxPhoto(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl border border-red-900/30 text-red-400 bg-red-950/10 hover:bg-red-950/35 font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Delete Photo
                </button>

                {/* Re-download picture */}
                <a
                  href={activeLightboxPhoto.url}
                  download={`RetroCam_Export_${activeLightboxPhoto.id}.jpg`}
                  className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all text-center"
                >
                  <Download className="w-4 h-4" /> Download Jpeg
                </a>
              </div>
            </div>

          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: PWA & APP CAPABILITY INFORMATION */}
      <AnimatePresence>
        {showInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-md space-y-5 max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-orange-500" />
                  Android Home Screen Guide
                </h3>
                <button onClick={() => setShowInfoModal(false)} className="text-neutral-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
                <p>
                  You do not need to sideload complex unverified `.apk` files to use **RetroCam Custom Filter Camera** natively on your phone.
                </p>
                
                <p className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 text-orange-400">
                  This app is fully optimized as a modern **PWA (Progressive Web App)**. It launches full-screen without Chrome address bars, binds directly to your hardware camera, and saves files directly to your Native Photo Album.
                </p>

                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-200 uppercase tracking-wider text-[10px] font-mono">How to setup on Android:</h4>
                  <div className="space-y-3.5 pl-1">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center font-mono font-bold text-[10px] text-orange-400 shrink-0">1</span>
                      <p>Open the **Shared App URL** on Google Chrome on your Android smartphone.</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center font-mono font-bold text-[10px] text-orange-400 shrink-0">2</span>
                      <p>Tap the menu icon (the **three dots** in Chrome's top-right corner).</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center font-mono font-bold text-[10px] text-orange-400 shrink-0">3</span>
                      <p>Select **"Add to Home screen"** or **"Install app"** from the drop-down menu.</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center font-mono font-bold text-[10px] text-orange-400 shrink-0">4</span>
                      <p>Tap **"Install"**. Chrome will verify the package assets and pin the app to your Home Screen with a native RetroCam icon.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-950/40 border border-neutral-800/60 rounded-2xl p-4 space-y-2">
                  <h4 className="font-bold text-neutral-300 text-[11px]">How files are saved:</h4>
                  <p className="text-neutral-400 text-[11px]">
                    When you click the shutter button, the processed retro-styled photo exports as a `.jpg` directly. This triggers the native Android Downloader, meaning it instantly writes directly into your phone's native **Gallery / Album / DCIM downloads** just like typical pictures.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs active:scale-95 transition-all text-center"
                >
                  Got It, Ready to Shoot!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
