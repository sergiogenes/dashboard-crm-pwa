'use client'

import { useState, useEffect } from 'react'
import {
  getSupervisorDashboardData,
  updateDisbursementGoal,
  getSalespeople,
  importProspectsFromCSV,
  assignLeadToSalesperson,
} from '@/app/actions/supervisor'
import {
  TrendingUp,
  Users,
  CheckCircle2,
  DollarSign,
  UploadCloud,
  UserPlus,
  Loader2,
  AlertCircle,
  FolderPlus,
  ArrowRight,
  TrendingDown,
  Edit3,
  Check,
  X,
} from 'lucide-react'

interface SalespersonPerf {
  id: string
  name: string
  email: string
  crmOwnerId: string
  totalDisbursed: number
  totalDeals: number
  pendingDeals: number
}

interface Prospect {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  documentId: string
  scoring?: string
  crmSynced: boolean
  createdAt: number
}

interface SalespersonSimple {
  id: string
  name: string
  email: string
  crmOwnerId?: string
}

export default function SupervisorDashboard() {
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [stats, setStats] = useState<{
    disbursementGoal: number
    totalDisbursed: number
    totalOperations: number
    pendingApprovalCount: number
    salespeople: SalespersonPerf[]
    prospects: Prospect[]
  } | null>(null)

  const [salespeopleList, setSalespeopleList] = useState<SalespersonSimple[]>(
    [],
  )

  // Editar Objetivo
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [newGoal, setNewGoal] = useState('')

  // Control de pestañas
  const [activeTab, setActiveTab] = useState<'team' | 'import' | 'assign'>(
    'team',
  )

  // CSV State
  const [parsedLeads, setParsedLeads] = useState<any[]>([])
  const [importResult, setImportResult] = useState<{
    importedCount: number
    skippedCount: number
    errors: string[]
  } | null>(null)

  // Asignación de Leads
  const [selectedSalespeople, setSelectedSalespeople] = useState<{
    [leadId: string]: string
  }>({})

  // Cargar datos del dashboard
  const fetchDashboardData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true)
      const data = await getSupervisorDashboardData()
      setStats(data)
      setNewGoal(data.disbursementGoal.toString())

      const people = await getSalespeople()
      setSalespeopleList(people)
    } catch (err) {
      console.error('Error al cargar datos del supervisor:', err)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData(false)

    // Polling silencioso cada 15 segundos para mantener actualizado el dashboard
    const interval = setInterval(() => {
      fetchDashboardData(true)
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  // Modificar objetivo
  const handleUpdateGoal = async () => {
    const goalNum = parseFloat(newGoal)
    if (isNaN(goalNum) || goalNum <= 0) {
      alert('Por favor ingresa un objetivo válido')
      return
    }

    try {
      setActionLoading(true)
      await updateDisbursementGoal(goalNum)
      if (stats) {
        setStats({ ...stats, disbursementGoal: goalNum })
      }
      setIsEditingGoal(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Parsear CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      const lines = text.split(/\r?\n/).filter((line) => line.trim())
      if (lines.length < 2) {
        alert('El archivo CSV está vacío o no contiene suficientes filas.')
        return
      }

      // Auto-detectar separador (coma o punto y coma)
      const firstLine = lines[0]
      const separator = firstLine.includes(';') ? ';' : ','
      const headers = firstLine
        .split(separator)
        .map((h) => h.trim().toLowerCase().replace(/["']/g, ''))

      // Buscar índices por sinónimos
      const dniIdx = headers.findIndex(
        (h) =>
          h.includes('dni') ||
          h.includes('cedula') ||
          h.includes('document') ||
          h.includes('id') ||
          h.includes('identificacion'),
      )
      const nameIdx = headers.findIndex(
        (h) =>
          h.includes('nombre') ||
          h.includes('first name') ||
          h.includes('firstname') ||
          h.includes('name'),
      )
      const lastNameIdx = headers.findIndex(
        (h) =>
          h.includes('apellido') ||
          h.includes('last name') ||
          h.includes('lastname'),
      )
      const emailIdx = headers.findIndex(
        (h) =>
          h.includes('email') || h.includes('correo') || h.includes('mail'),
      )
      const phoneIdx = headers.findIndex(
        (h) =>
          h.includes('telefono') ||
          h.includes('phone') ||
          h.includes('celular') ||
          h.includes('tel'),
      )

      if (dniIdx === -1 || nameIdx === -1 || emailIdx === -1) {
        alert(
          'No se encontraron las columnas obligatorias en el CSV.\nAsegúrate de tener columnas con encabezados como:\n"DNI" o "Cedula", "Nombre" y "Email".',
        )
        return
      }

      const tempLeads = []
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
          .split(separator)
          .map((val) => val.trim().replace(/["']/g, ''))
        if (row.length < headers.length) continue

        tempLeads.push({
          documentId: row[dniIdx],
          firstName: row[nameIdx],
          lastName: lastNameIdx !== -1 ? row[lastNameIdx] : '',
          email: row[emailIdx],
          phone: phoneIdx !== -1 ? row[phoneIdx] : '',
        })
      }

      setParsedLeads(tempLeads)
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  // Importar prospectos parseados
  const handleImportProspects = async () => {
    if (parsedLeads.length === 0) return

    try {
      setActionLoading(true)
      const res = await importProspectsFromCSV(parsedLeads)
      setImportResult(res)
      setParsedLeads([])
      // Recargar datos
      const updatedData = await getSupervisorDashboardData()
      setStats(updatedData)
    } catch (err: any) {
      alert(`Error al importar: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Asignar Lead
  const handleAssignLead = async (leadId: string) => {
    const salespersonId = selectedSalespeople[leadId]
    if (!salespersonId) {
      alert('Por favor selecciona un vendedor del listado')
      return
    }

    try {
      setActionLoading(true)
      await assignLeadToSalesperson(leadId, salespersonId)

      // Eliminar de los estados locales de prospectos
      if (stats) {
        setStats({
          ...stats,
          prospects: stats.prospects.filter((p) => p.id !== leadId),
        })
      }

      // Limpiar selección
      const updatedSelects = { ...selectedSalespeople }
      delete updatedSelects[leadId]
      setSelectedSalespeople(updatedSelects)

      alert(
        'Prospecto asignado correctamente y programado para sincronizarse con HubSpot.',
      )
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-indigo-500" />
        <p className="animate-pulse text-sm font-medium">
          Cargando datos de supervisión...
        </p>
      </div>
    )
  }

  const disbursementProgress = stats
    ? Math.min(
        Math.round((stats.totalDisbursed / stats.disbursementGoal) * 100),
        100,
      )
    : 0

  return (
    <div className="animate-fade-in space-y-8 text-white">
      {/* Encabezado */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="bg-gradient-to-r from-indigo-200 via-slate-100 to-violet-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
            Panel de Supervisión y Control
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Visualiza el progreso de desembolsos de tu equipo, administra
            prospectos y delega leads.
          </p>
        </div>

        {/* Configuración de Objetivo */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-3 backdrop-blur-sm">
          <div className="text-right">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Objetivo de Desembolsos
            </span>
            {isEditingGoal ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleUpdateGoal}
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-500/20 p-1 text-emerald-400 hover:bg-emerald-500/30"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setIsEditingGoal(false)
                    setNewGoal(stats?.disbursementGoal.toString() || '')
                  }}
                  className="rounded-lg bg-rose-500/20 p-1 text-rose-400 hover:bg-rose-500/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <span className="mt-0.5 block text-sm font-extrabold text-indigo-400">
                ${stats?.disbursementGoal.toLocaleString()} USD
              </span>
            )}
          </div>
          {!isEditingGoal && (
            <button
              onClick={() => setIsEditingGoal(true)}
              className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grid de Estadísticas */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Desembolsos */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Desembolsado
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                ${stats?.totalDisbursed.toLocaleString()} USD
              </h3>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Progreso de Meta</span>
              <span className="font-semibold text-emerald-400">
                {disbursementProgress}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                style={{ width: `${disbursementProgress}%` }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
              />
            </div>
          </div>
        </div>

        {/* Total Operaciones */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Operaciones (Deals)
              </p>
              <h3 className="mt-2 text-3xl font-extrabold text-white">
                {stats?.totalOperations}
              </h3>
            </div>
            <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span>Operaciones de préstamos activas</span>
          </div>
        </div>

        {/* En aprobación */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                En Aprobación
              </p>
              <h3 className="mt-2 text-3xl font-extrabold text-white">
                {stats?.pendingApprovalCount}
              </h3>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Pendientes de desembolsar</span>
          </div>
        </div>

        {/* Vendedores a cargo */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Asesores a Cargo
              </p>
              <h3 className="mt-2 text-3xl font-extrabold text-white">
                {stats?.salespeople.length}
              </h3>
            </div>
            <div className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span>Vendedores en tu equipo</span>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('team')}
          className={`border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'team'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Rendimiento del Equipo
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'import'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Cargar Prospectos (CSV)
        </button>
        <button
          onClick={() => setActiveTab('assign')}
          className={`border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'assign'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Asignar Contactos ({stats?.prospects.length || 0})
        </button>
      </div>

      {/* Contenido de Pestañas */}
      <div className="space-y-6">
        {/* Pestaña: Rendimiento del Equipo */}
        {activeTab === 'team' && (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/20 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <h4 className="text-base font-bold">
                Listado de Vendedores del Equipo
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4">Vendedor</th>
                    <th className="px-6 py-4 text-center">Deals Totales</th>
                    <th className="px-6 py-4 text-center">Deals Pendientes</th>
                    <th className="px-6 py-4 text-right">Total Desembolsado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {stats?.salespeople.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-500"
                      >
                        No hay vendedores asignados a tu cuenta de supervisor.
                      </td>
                    </tr>
                  ) : (
                    stats?.salespeople.map((sp) => (
                      <tr
                        key={sp.id}
                        className="transition-colors hover:bg-slate-900/10"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">
                            {sp.name}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {sp.email}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500">
                            CRM Owner ID: {sp.crmOwnerId}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-slate-300">
                          {sp.totalDeals}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              sp.pendingDeals > 0
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {sp.pendingDeals}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-400">
                          ${sp.totalDisbursed.toLocaleString()} USD
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pestaña: Cargar Prospectos (CSV) */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-6 backdrop-blur-md">
              <h4 className="mb-2 text-base font-bold">Importar Archivo CSV</h4>
              <p className="mb-6 text-xs text-slate-400">
                Sube una lista de contactos en formato `.csv` con separador de
                comas (,) o punto y coma (;). El archivo debe contener
                encabezados para
                <strong className="text-indigo-400">
                  {' '}
                  DNI/Cédula, Nombre y Email
                </strong>{' '}
                (el teléfono es opcional).
              </p>

              <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 p-8 text-center transition-colors hover:border-indigo-500/50">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <UploadCloud className="mb-3 h-10 w-10 text-indigo-400" />
                <span className="text-sm font-semibold text-white">
                  Selecciona tu archivo CSV
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  O arrastra el archivo aquí
                </span>
              </div>

              {/* Vista previa de prospectos parseados */}
              {parsedLeads.length > 0 && (
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-bold text-slate-200">
                      Vista Previa: {parsedLeads.length} prospectos listos para
                      cargar
                    </h5>
                    <button
                      onClick={handleImportProspects}
                      disabled={actionLoading}
                      className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-lg transition-colors hover:bg-indigo-600 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FolderPlus className="h-4 w-4" />
                      )}
                      Importar Todos
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-900 uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-2.5">DNI/Cédula</th>
                          <th className="px-4 py-2.5">Nombre</th>
                          <th className="px-4 py-2.5">Email</th>
                          <th className="px-4 py-2.5">Teléfono</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {parsedLeads.map((pl, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-mono">
                              {pl.documentId}
                            </td>
                            <td className="px-4 py-2 font-semibold">
                              {pl.firstName} {pl.lastName}
                            </td>
                            <td className="px-4 py-2">{pl.email}</td>
                            <td className="px-4 py-2">{pl.phone || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Logs del resultado de importación */}
              {importResult && (
                <div className="mt-8 space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                  <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Resultado de la Carga
                  </h5>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-emerald-400">
                      <span className="block text-xl font-bold">
                        {importResult.importedCount}
                      </span>
                      <span>Prospectos Creados</span>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-center text-slate-400">
                      <span className="block text-xl font-bold">
                        {importResult.skippedCount}
                      </span>
                      <span>Duplicados / Saltados</span>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="mt-4">
                      <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Listado de Errores de Validación:
                      </span>
                      <ul className="max-h-36 list-disc space-y-1 overflow-y-auto rounded-lg border border-rose-500/15 bg-rose-500/5 p-3 pl-5 text-[11px] text-rose-300">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pestaña: Asignar Contactos */}
        {activeTab === 'assign' && (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/20 backdrop-blur-md">
            <div className="border-b border-slate-800 px-6 py-5">
              <h4 className="text-base font-bold">
                Listado de prospectos sin asignar
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                Selecciona a un vendedor de tu equipo para derivarle cada
                prospecto. El vendedor podrá gestionarlo en su dashboard local
                inmediatamente.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4">Prospecto</th>
                    <th className="px-6 py-4">Contacto</th>
                    <th className="px-6 py-4 text-center">Estado Sinc.</th>
                    <th className="px-6 py-4 text-right">Asignar a Vendedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {stats?.prospects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-12 text-center text-slate-500"
                      >
                        No tienes prospectos pendientes de asignación. Carga un
                        archivo CSV para ingresar nuevos prospectos.
                      </td>
                    </tr>
                  ) : (
                    stats?.prospects.map((pr) => (
                      <tr
                        key={pr.id}
                        className="transition-colors hover:bg-slate-900/10"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">
                            {pr.firstName} {pr.lastName}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                            DNI/Cédula: {pr.documentId}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-300">
                            {pr.email}
                          </div>
                          {pr.phone && (
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              {pr.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              pr.crmSynced
                                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                : 'border border-amber-500/20 bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {pr.crmSynced ? 'Sincronizado' : 'Pendiente Sync'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <select
                              value={selectedSalespeople[pr.id] || ''}
                              onChange={(e) =>
                                setSelectedSalespeople({
                                  ...selectedSalespeople,
                                  [pr.id]: e.target.value,
                                })
                              }
                              className="w-48 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">Selecciona Vendedor...</option>
                              {salespeopleList.map((sp) => (
                                <option key={sp.id} value={sp.id}>
                                  {sp.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssignLead(pr.id)}
                              disabled={
                                actionLoading || !selectedSalespeople[pr.id]
                              }
                              className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-bold text-white shadow shadow-indigo-500/10 transition-colors hover:bg-indigo-600 disabled:opacity-40"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Derivar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
