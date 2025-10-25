import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { orgId, siteId, courtId, startsAt, endsAt, priceInt, currency = 'CRC' } = body || {}

  if (!orgId || !siteId || !courtId || !startsAt || !endsAt || !priceInt) {
    return new Response(JSON.stringify({ ok:false, msg: 'Missing fields' }), { status: 400 })
  }

  const supabase = supabaseAdmin()

  // 1) Validar disponibilidad
  const { data: available, error: e1 } = await supabase.rpc('fn_is_available', {
    _court: courtId,
    _starts: startsAt,
    _ends: endsAt
  })

  if (e1) return new Response(JSON.stringify({ ok:false, msg: e1.message }), { status: 400 })
  if (!available) return new Response(JSON.stringify({ ok:false, msg: 'Slot not available' }), { status: 409 })

  // 2) Crear HOLD por 15 minutos
  const holdExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { data: resv, error: e2 } = await supabase
    .from('reservation')
    .insert([{
      org_id: orgId,
      site_id: siteId,
      court_id: courtId,
      start_time: startsAt,
      end_time: endsAt,
      currency,
      price_int: priceInt,
      status: 'HELD',
      hold_expires_at: holdExpires
    }])
    .select('*')
    .single()

  if (e2) return new Response(JSON.stringify({ ok:false, msg: e2.message }), { status: 400 })

  // TODO: Crear registro payment INITIATED y generar checkout Tilopay; enviar resv.id como metadata
  return new Response(JSON.stringify({ ok:true, reservationId: resv.id, holdExpires }), { status: 200 })
}