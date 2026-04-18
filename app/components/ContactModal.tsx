'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    userEmail: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('문의가 성공적으로 전송되었습니다.');
        onClose();
        setFormData({ title: '', content: '', userEmail: '' });
      } else {
        const data = await response.json();
        alert(`전송 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      alert('문의 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-5 bg-blue-600 text-white flex justify-between items-center">
          <h3 className="text-xl font-bold">문의하기</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleContactSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="제목을 입력해주세요"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일 (답변용)</label>
            <input
              type="email"
              value={formData.userEmail}
              onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="example@email.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">문의 내용</label>
            <textarea
              required
              rows={5}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder="문의하실 내용을 입력해주세요"
            ></textarea>
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl text-white font-black transition-all ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-lg hover:shadow-blue-200'
              }`}
            >
              {isSubmitting ? '전송 중...' : '문의 보내기'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
