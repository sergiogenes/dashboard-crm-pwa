import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Barra lateral de navegación sticky */}
      <Sidebar />

      {/* Contenedor del contenido principal */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        
        {/* Panel central de visualización */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
