'use client';

import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './ui/Button';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
    onClear();
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) {
      onClear();
      return;
    }
    const dataUrl = sigCanvas.current?.getCanvas().toDataURL('image/png');
    if (dataUrl) {
      onSave(dataUrl);
    }
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 overflow-hidden h-48 relative">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            className: 'w-full h-full cursor-crosshair',
          }}
          onEnd={save}
        />
        <button
          type="button"
          onClick={clear}
          className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors"
          title="Clear signature"
        >
          <RotateCcw className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <p className="text-xs text-gray-500 text-center">위 사각형 안에 서명해 주세요.</p>
    </div>
  );
};
