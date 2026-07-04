export interface FilterPreset {
  id: string;
  name: string;
  strength: number;       // 0 to 1 (multiplier for the overall filter effect)
  colorTemp: number;      // -100 (cool/blue) to 100 (warm/amber)
  contrast: number;       // 50 to 150 (percentage)
  saturation: number;     // 0 to 200 (percentage)
  filmGrain: number;      // 0 to 100 (intensity)
  isCustom?: boolean;
}

export interface CameraProfile {
  id: string;
  name: string;
  imageUrl: string;
  defaultPreset: FilterPreset;
  isCustom: boolean;
}

