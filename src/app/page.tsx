import BookingWizard from '@/components/BookingWizard';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-xl mx-auto text-center mb-10">
        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold tracking-wide uppercase mb-3">
          Circto Engine
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
          Circto Scheduler
        </h1>
        <p className="text-slate-600 mt-2 text-sm">
          High-concurrency reservation engine with atomic lock protection.
        </p>
      </div>

      <BookingWizard
        providerId="prov_123"
        metadataContext={{
          client_tenant_id: 'tenant_circto_beta',
          service_type: 'technical_consultation',
        }}
      />
    </main>
  );
}