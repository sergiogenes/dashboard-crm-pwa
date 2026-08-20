'use client'

import React from 'react'
import { Cloud, Database, Edit2, Trash2 } from 'lucide-react'
import { LocalCompany } from '@/lib/db'
import { useConfigurableColumns, ConfigurableColumn } from '@/hooks/useConfigurableColumns'
import ColumnPicker from '@/components/ColumnPicker'

interface CompanyTableProps {
  filteredCompanies: LocalCompany[]
  setCompanyToEdit: (company: LocalCompany | null) => void
  setIsCompanyModalOpen: (open: boolean) => void
  handleDeleteCompany: (company: LocalCompany) => void
}

// "Nombre" y "Acciones" quedan fijas (identidad + acciones de la fila); el
// resto es configurable. Mismo hook/componente que Contactos y Negocios.
const CONFIGURABLE_COLUMNS: ConfigurableColumn[] = [
  { key: 'domain', label: 'Dominio', defaultOn: true },
  { key: 'sync', label: 'Origen / Sinc', defaultOn: false, devOnly: true },
]

export default function CompanyTable({
  filteredCompanies,
  setCompanyToEdit,
  setIsCompanyModalOpen,
  handleDeleteCompany,
}: CompanyTableProps) {
  const { isVisible, toggleColumn } = useConfigurableColumns(
    'companiesTable.visibleColumns',
    CONFIGURABLE_COLUMNS,
  )

  const columnCount = 2 + CONFIGURABLE_COLUMNS.filter((c) => isVisible(c.key)).length

  return (
    <div className="hidden md:block overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-ink-2">
          <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wider text-ink-3 border-b border-border">
            <tr>
              <th scope="col" className="px-6 py-4">Nombre</th>
              {isVisible('domain') && (
                <th scope="col" className="px-6 py-4">Dominio</th>
              )}
              {isVisible('sync') && (
                <th scope="col" className="px-6 py-4">Origen / Sinc</th>
              )}
              <th scope="col" className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  Acciones
                  <ColumnPicker
                    columns={CONFIGURABLE_COLUMNS}
                    isVisible={isVisible}
                    onToggle={toggleColumn}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-2 bg-transparent">
            {filteredCompanies.length > 0 ? (
              filteredCompanies.map((company) => (
                <tr
                  key={company.id || company.tempId}
                  className="hover:bg-surface-2 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-ink">
                    {company.name}
                  </td>
                  {isVisible('domain') && (
                    <td className="px-6 py-4 text-ink-2">
                      {company.domain || '-'}
                    </td>
                  )}
                  {isVisible('sync') && (
                    <td className="px-6 py-4">
                      {company.synced ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-0.5 text-xs font-medium text-ok border border-ok-bd">
                          <Cloud className="h-3.5 w-3.5" />
                          CloudDb
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-medium text-warn border border-warn-bd animate-pulse">
                          <Database className="h-3.5 w-3.5" />
                          LocalDb
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
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
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columnCount} className="px-6 py-12 text-center text-ink-3">
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
