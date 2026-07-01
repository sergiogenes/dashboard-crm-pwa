'use client'

import React from 'react'
import { Cloud, Database, Edit2, Trash2 } from 'lucide-react'
import { LocalCompany } from '@/lib/db'

interface CompanyTableProps {
  filteredCompanies: LocalCompany[]
  setCompanyToEdit: (company: LocalCompany | null) => void
  setIsCompanyModalOpen: (open: boolean) => void
  handleDeleteCompany: (company: LocalCompany) => void
}

export default function CompanyTable({
  filteredCompanies,
  setCompanyToEdit,
  setIsCompanyModalOpen,
  handleDeleteCompany,
}: CompanyTableProps) {
  return (
    <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-slate-300">
          <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th scope="col" className="px-6 py-4">Nombre</th>
              <th scope="col" className="px-6 py-4">Dominio</th>
              <th scope="col" className="px-6 py-4">Origen / Sinc</th>
              <th scope="col" className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-transparent">
            {filteredCompanies.length > 0 ? (
              filteredCompanies.map((company) => (
                <tr
                  key={company.id || company.tempId}
                  className="hover:bg-slate-900/40 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-white">
                    {company.name}
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {company.domain || '-'}
                  </td>
                  <td className="px-6 py-4">
                    {company.synced ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                        <Cloud className="h-3.5 w-3.5" />
                        CloudDb
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20 animate-pulse">
                        <Database className="h-3.5 w-3.5" />
                        LocalDb
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setCompanyToEdit(company)
                          setIsCompanyModalOpen(true)
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(company)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                  No se encontraron empresas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
