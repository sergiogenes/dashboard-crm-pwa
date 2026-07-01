'use client'

import React from 'react'
import {
  ShieldAlert,
  Users,
  UserCheck,
  Search,
  Loader2,
  Save,
} from 'lucide-react'
import { useAdmin } from '@/hooks/useAdmin'

export default function AdminPage() {
  const {
    loading,
    actionLoading,
    supervisors,
    salespeople,
    searchTerm,
    setSearchTerm,
    selectedSupervisorId,
    assignedSalespeopleIds,
    handleSelectSupervisor,
    handleRoleToggle,
    toggleSalespersonAssign,
    handleSaveAssignments,
    filteredUsers,
  } = useAdmin()

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-indigo-500" />
        <p className="animate-pulse text-sm font-medium">
          Cargando panel de administración...
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8 text-white">
      {/* Encabezado */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="bg-gradient-to-r from-indigo-200 via-slate-100 to-violet-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
            Administración de Usuarios y Roles
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Promueve usuarios a supervisores y asigna vendedores a cargo de cada equipo.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2 text-xs text-slate-500">
          <ShieldAlert className="h-4 w-4 text-indigo-400" />
          Consola con privilegios de Administrador.
        </div>
      </div>

      {/* Grid de Secciones */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Columna Izquierda: Tabla de Usuarios y Roles (7 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/20 p-5 backdrop-blur-md">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <h4 className="flex items-center gap-2 text-base font-bold">
                <Users className="h-5 w-5 text-indigo-400" />
                Listado de Usuarios
              </h4>

              {/* Buscador */}
              <div className="relative w-full sm:w-64">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/20 font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Supervisor Actual</th>
                    <th className="px-4 py-3 text-right">Rol / Privilegio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-slate-500"
                      >
                        No se encontraron usuarios.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="transition-colors hover:bg-slate-900/10"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-white">
                            {u.name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            {u.email}
                          </div>
                          {u.crmOwnerId && (
                            <div className="mt-1 font-mono text-[9px] text-slate-500">
                              Owner ID: {u.crmOwnerId}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {u.roles.includes('user') ? (
                            u.supervisorName ? (
                              <span className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                                {u.supervisorName}
                              </span>
                            ) : (
                              <span className="text-xs italic text-slate-500">
                                Sin asignar
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              N/A
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            {(['user', 'supervisor', 'admin'] as const).map(
                              (r) => {
                                const labelMap = {
                                  user: 'Vendedor',
                                  supervisor: 'Supervisor',
                                  admin: 'Admin',
                                }
                                const isChecked = u.roles.includes(r)
                                return (
                                  <label
                                    key={r}
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all ${
                                      isChecked
                                        ? 'border-indigo-500/30 bg-indigo-500/5 text-indigo-300'
                                        : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:text-slate-300'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={actionLoading}
                                      onChange={() =>
                                        handleRoleToggle(u.id, u.roles, r)
                                      }
                                      className="rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                                    />
                                    <span>{labelMap[r]}</span>
                                  </label>
                                )
                              },
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Asignación de Vendedores a Supervisores (5 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-950/20 p-5 backdrop-blur-md">
            <h4 className="flex items-center gap-2 text-base font-bold">
              <UserCheck className="h-5 w-5 text-indigo-400" />
              Asignación de Vendedores
            </h4>

            {/* Selector de Supervisor */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Selecciona un Supervisor:
              </label>
              <select
                value={selectedSupervisorId}
                onChange={(e) => handleSelectSupervisor(e.target.value)}
                className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {supervisors.length === 0 ? (
                  <option value="">No hay supervisores registrados</option>
                ) : (
                  supervisors.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.email})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Listado de vendedores para asociar */}
            {selectedSupervisorId && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Vendedores a Cargo:
                  </span>
                  <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                    {assignedSalespeopleIds.length} seleccionados
                  </span>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  {salespeople.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No hay vendedores registrados en la plataforma.
                    </div>
                  ) : (
                    salespeople.map((sp) => {
                      const isAssignedToThis = assignedSalespeopleIds.includes(
                        sp.id,
                      )
                      const isAssignedToOther =
                        sp.supervisorId &&
                        sp.supervisorId !== selectedSupervisorId

                      return (
                        <label
                          key={sp.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all hover:bg-slate-900/30 ${
                            isAssignedToThis
                              ? 'border-indigo-500/30 bg-indigo-500/5'
                              : 'border-slate-800 bg-slate-950/20'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isAssignedToThis}
                            onChange={() => toggleSalespersonAssign(sp.id)}
                            className="mt-0.5 rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-white">
                              {sp.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                              {sp.email}
                            </span>
                            {isAssignedToOther && (
                              <span className="mt-1.5 inline-block rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                                Cambiará de: {sp.supervisorName}
                              </span>
                            )}
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>

                {/* Botón Guardar Asignaciones */}
                <button
                  onClick={handleSaveAssignments}
                  disabled={actionLoading || salespeople.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar Asignaciones
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
