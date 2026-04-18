export type FieldType = 'text' | 'textarea' | 'tel' | 'date' | 'time' | 'datetime-local' | 'select' | 'radio' | 'checkbox' | 'signature';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // For select, radio, checkbox
  placeholder?: string;
}

export interface VisitPurpose {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  isActive: boolean;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
  notificationEnabled?: boolean;
  notificationType?: 'text' | 'image' | 'both';
  notificationText?: string;
  notificationImage?: string;
  showSafetyInfo?: boolean;
  safetyHazards?: string[];
  safetyPrecautions?: string[];
}

export interface VisitorLog {
  id: string;
  purposeId: string;
  purposeName: string;
  visitorName: string;
  visitorContact: string;
  data: Record<string, any>;
  signature: string;
  ownerId: string;
  visitDate: any;
  createdAt: any;
  adminSignature?: string;
  adminSignedAt?: any;
  safetyInfoSnapshot?: {
    hazards: string[];
    precautions: string[];
  };
}

export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin';
  createdAt: any;
  qrText?: string;
  qrTitle?: string;
  brandingLogo?: string;
  brandingTitle?: string;
  brandingType?: 'icon' | 'banner';
  brandingColor?: string;
  brandingBannerPosition?: number; 
  brandingBannerCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
