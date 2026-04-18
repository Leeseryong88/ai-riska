export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'windy';

export interface SafetyCheckItem {
  id: string;
  label: string;
  checked: boolean;
  remark?: string;
}

export interface SafetyLog {
  id?: string;
  title: string;
  date: string; // YYYY-MM-DD
  weather?: Weather;
  temperature?: string;
  workSummary: string;
  manpower?: {
    total: number;
    details: { [role: string]: number };
  };
  safetyChecks: SafetyCheckItem[];
  issues: string;
  photos: string[]; // URLs
  managerId: string;
  createdAt: any;
  updatedAt: any;
}
