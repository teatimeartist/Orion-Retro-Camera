import { CameraProfile } from '../types';

export const DEFAULT_CAMERAS: CameraProfile[] = [
  {
    id: 'fujifilm-xt5',
    name: 'Fujifilm Classic',
    imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80',
    defaultPreset: {
      id: 'fuji-preset',
      name: 'Classic Chrome',
      strength: 0.85,
      colorTemp: 18,
      contrast: 115,
      saturation: 110,
      filmGrain: 28,
    },
    isCustom: false
  },
  {
    id: 'hasselblad-500c',
    name: 'Hasselblad 500C',
    imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80',
    defaultPreset: {
      id: 'hassel-preset',
      name: 'Medium Format Gold',
      strength: 0.9,
      colorTemp: 22,
      contrast: 98,
      saturation: 95,
      filmGrain: 15,
    },
    isCustom: false
  },
  {
    id: 'nikon-f3',
    name: 'Nikon F3',
    imageUrl: 'https://images.unsplash.com/photo-1502920917128-1da500b45ae5?auto=format&fit=crop&w=600&q=80',
    defaultPreset: {
      id: 'nikon-preset',
      name: 'Crisp Neutral',
      strength: 0.75,
      colorTemp: -10,
      contrast: 120,
      saturation: 100,
      filmGrain: 12,
    },
    isCustom: false
  },
  {
    id: 'leica-m6',
    name: 'Leica M6 Noir',
    imageUrl: 'https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?auto=format&fit=crop&w=600&q=80',
    defaultPreset: {
      id: 'leica-preset',
      name: 'Summicron B&W',
      strength: 1.0,
      colorTemp: 0,
      contrast: 138,
      saturation: 0,
      filmGrain: 50,
    },
    isCustom: false
  },
  {
    id: 'olympus-om1',
    name: 'Olympus OM-1',
    imageUrl: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&w=600&q=80',
    defaultPreset: {
      id: 'olympus-preset',
      name: 'Consumer Warmth',
      strength: 0.85,
      colorTemp: 40,
      contrast: 108,
      saturation: 115,
      filmGrain: 65,
    },
    isCustom: false
  },
  {
    id: 'pentax-67',
    name: 'Pentax 67',
    imageUrl: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=600&q=80',
    defaultPreset: {
      id: 'pentax-preset',
      name: 'Ektar Cinematic',
      strength: 0.9,
      colorTemp: 28,
      contrast: 125,
      saturation: 85,
      filmGrain: 45,
    },
    isCustom: false
  }
];
