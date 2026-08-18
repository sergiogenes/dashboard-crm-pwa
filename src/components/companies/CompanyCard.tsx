'use client'

import React from 'react'
import { Cloud, Database, Edit2, Trash2 } from 'lucide-react'
import { LocalCompany } from '@/lib/db'

interface CompanyCardProps {
  filteredCompanies: LocalCompany[]
  setCompanyToEdit: (company: LocalCompany | null) => void
  setIsCompanyModalOpen: (open: boolean) => void
  handleDeleteCompany: (company: LocalCompany) => void
}

export default function CompanyCard({
  filteredCompanies,
  setCompanyToEdit,
  setIsCompanyModalOpen,
  handleDeleteCompany,
}: CompanyCardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:hidden">
      {filteredCompanies.length > 0 ? (
        filteredCompanies.map((company) => (
          <div
            key={company.id || company.tempId}
            className="rounded-2xl border border-border bg-surface p-4 space-y-3"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-ink text-sm">
                  {company.name}
                </h3>
                {company.domain && (
                  <p className="text-xs text-ink-2 mt-0.5">{company.domain}</p>
                )}
              </div>
              <div>
                {company.synced ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[10px] font-medium text-ok border border-ok-bd">
                    <Cloud className="h-3 w-3" />
                    CloudDb
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-medium text-warn border border-warn-bd animate-pulse">
                    <Database className="h-3 w-3" />
                    LocalDb
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-2">
              <button
                onClick={() => {
                  setCompanyToEdit(company)
                  setIsCompanyModalOpen(true)
                }}
                className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                title="Editar"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteCompany(company)}
                className="rounded-lg p-1.5 text-ink-2 hover:bg-bad-bg hover:text-bad transition-colors"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="text-center text-xs text-ink-3 py-12">No se encontraron empresas.</p>
      )}
    </div>
  )
}
