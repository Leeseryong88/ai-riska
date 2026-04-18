'use client';

import React, { useState, useRef, useEffect } from 'react';
import { compressImage as compressImageUtil } from '@/app/lib/image-utils';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
}

const ImageUploader = ({ onImageUpload }: ImageUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (isValidImageFile(file)) {
        processFile(file);
      } else {
        alert('유효한 이미지 파일을 업로드해주세요 (JPEG, PNG, GIF, WebP)');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (isValidImageFile(file)) {
        processFile(file);
      } else {
        alert('유효한 이미지 파일을 업로드해주세요 (JPEG, PNG, GIF, WebP)');
      }
    }
  };

  const processFile = async (file: File) => {
    setIsCompressing(true);
    try {
      // 이미지 압축 (최대 1600px, 품질 0.7)
      // 파일이 이미 작더라도 일관된 포맷(JPEG)과 리사이징을 위해 항상 압축 프로세스를 거칩니다.
      const compressed = await compressImageUtil(file, 1600, 1600, 0.7);
      
      let finalFile: File;
      if (compressed instanceof File) {
        finalFile = compressed;
      } else if (compressed instanceof Blob) {
        finalFile = new File([compressed], file.name, { type: 'image/jpeg' });
      } else {
        // string (DataURL)인 경우 (드문 케이스)
        const response = await fetch(compressed);
        const blob = await response.blob();
        finalFile = new File([blob], file.name, { type: 'image/jpeg' });
      }

      const previewUrl = URL.createObjectURL(finalFile);
      setPreview(previewUrl);
      onImageUpload(finalFile);
      console.log(`원본 크기: ${(file.size / 1024 / 1024).toFixed(2)}MB, 압축 후: ${(finalFile.size / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      console.error('이미지 압축 중 오류 발생:', error);
      // 오류 발생 시 원본 사용
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      onImageUpload(file);
    } finally {
      setIsCompressing(false);
    }
  };

  // 기존 로컬 compressImage 함수 삭제 (유틸리티로 대체됨)

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const isValidImageFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
  };

  // 컴포넌트가 언마운트될 때 URL 객체 해제
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center h-full ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
      />
      
      <div className="flex flex-col items-center justify-center h-full">
        {isCompressing ? (
          <div className="mb-4 w-full text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">이미지 압축 중...</p>
          </div>
        ) : preview ? (
          <div className="mb-2 md:mb-4 w-full">
            <h3 className="text-[10px] md:text-sm font-bold mb-1 md:mb-2 text-gray-500 uppercase tracking-wider">업로드된 이미지</h3>
            <div className="flex justify-center">
              <img 
                src={preview} 
                alt="미리보기" 
                className="max-h-24 md:max-h-40 object-contain rounded-lg shadow-sm border border-gray-100"
              />
            </div>
            <button
              type="button"
              onClick={handleButtonClick}
              className="mt-2 md:mt-3 px-2 py-1 md:px-3 md:py-1 bg-white border border-gray-200 text-gray-600 text-[10px] md:text-xs rounded-md hover:bg-gray-50 focus:outline-none transition-colors shadow-sm"
            >
              이미지 변경
            </button>
          </div>
        ) : (
          <>
            <svg
              className="w-10 h-10 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
            
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">이미지 선택</span> 또는 드래그 앤 드롭
            </p>
            <p className="text-xs text-gray-500 mb-3">
              지원 형식: JPEG, PNG, GIF, WebP (5MB 초과 시 자동 압축)
            </p>
            
            <button
              type="button"
              onClick={handleButtonClick}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
            >
              이미지 선택
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ImageUploader; 