import Link from 'next/link';
import { primaryServices, serviceCategories, services } from '@/config/services';
import ServiceGlyph from '@/components/navigation/ServiceGlyph';

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
              전체 서비스
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              필요한 분석 및 작성 도구를 선택하세요.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">
            {services.filter((s) => s.id !== 'board').length}개 서비스 사용 가능
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services
            .filter((service) => service.id !== 'board')
            .map((service) => (
            <Link
              key={service.id}
              href={service.href}
              className="group flex flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${service.accent.from} ${service.accent.to} text-white shadow-lg shadow-blue-500/10 transition-transform group-hover:scale-110`}
              >
                <ServiceGlyph icon={service.icon} className="h-6 w-6" />
              </div>
              
              <div className="mt-6 flex flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                    {service.shortTitle}
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 line-clamp-2">
                  {service.description}
                </p>
                
                <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                  <div className="flex gap-1.5">
                    {service.highlights.slice(0, 2).map((highlight) => (
                      <span key={highlight} className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                        {highlight}
                      </span>
                    ))}
                  </div>
                  <svg className="h-5 w-5 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
