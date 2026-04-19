import VisualDashboard from '@/components/dashboard/VisualDashboard';

export default function ServiceHub() {
  return (
    <div className="space-y-10">
      <section>
        <div className="mb-8 flex items-end justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">실시간 통합 대시보드</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              오늘의 안전 현황과 핵심 데이터를 한눈에 확인하고 다음 작업으로 바로 이어가세요.
            </p>
          </div>
        </div>
        <VisualDashboard />
      </section>
    </div>
  );
}
