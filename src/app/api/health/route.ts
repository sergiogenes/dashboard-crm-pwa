import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/mongodb'
import { CRMProviderFactory } from '@/lib/crm/factory'

// Forzar Next.js a no cachear este endpoint y ejecutarlo siempre de forma dinámica
export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 * Endpoint de monitoreo utilizado para el Health Check Polling de la PWA.
 * Evalúa el estado de la base de datos y la del CRM.
 * Si el CRM no responde pero MongoDB está disponible, retorna status 200 (degraded)
 * permitiendo que la cola de sincronización cliente-servidor continúe operacional.
 */
export async function GET() {
  try {
    // 1. Comprobar base de datos intermedia (MongoDB)
    await dbConnect()
    const isDbConnected = mongoose.connection.readyState === 1

    if (!isDbConnected) {
      return NextResponse.json(
        { status: 'error', database: 'disconnected', crm: 'unknown' },
        { status: 500 }
      )
    }

    // 2. Comprobar proveedor de CRM
    let isCrmHealthy = false
    try {
      const crm = CRMProviderFactory.getProvider()
      isCrmHealthy = await crm.checkHealth()
    } catch (e) {
      // Capturamos cualquier fallo de instanciación del token o error de conexión
      console.warn('[Health Check] Error al comprobar salud del CRM:', e)
    }

    if (!isCrmHealthy) {
      return NextResponse.json(
        { status: 'degraded', database: 'connected', crm: 'disconnected' },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { status: 'healthy', database: 'connected', crm: 'connected' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Health API Error]:', error)
    return NextResponse.json(
      { status: 'error', message: error.message || 'Unknown server error' },
      { status: 500 }
    )
  }
}
