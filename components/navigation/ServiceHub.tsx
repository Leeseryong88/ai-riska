import Link from 'next/link';
import { primaryServices, serviceCategories, services } from '@/config/services';
import ServiceGlyph from '@/components/navigation/ServiceGlyph';
import VisualDashboard from '@/components/dashboard/VisualDashboard';

function DeviceBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-600">
      {label}
    </span>
  );
}

export default function ServiceHub() {
  return (
    <div className="space-y-12">
      <section>
        <div className="mb-8 flex items-end justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              실시간 통합 대시보드
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              안전 데이터를 실시간으로 시각화하여 보여줍니다.
            </p>
          </div>
        </div>
        <VisualDashboard />
      </section>
    </div>
  );
}
