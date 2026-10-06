import { all, get, run, uid } from '../database'
import type { Client, ClientSummary, PaymentWithContext } from '../types'
import { nowIso } from '../database'
import { fromCents, toCents } from '../money'

interface ClientRow {
  id: string
  name: string
  created_at: string
}

function mapClient(row: ClientRow): Client {
  return { id: row.id, name: row.name, createdAt: row.created_at }
}

export function listClients(): ClientSummary[] {
  return all<ClientRow & { total_sales: number; total_payments: number }>(
    `SELECT c.id, c.name, c.created_at,
            COALESCE(s.totals, 0) AS total_sales,
            COALESCE(p.total, 0) AS total_payments
     FROM clients c
     LEFT JOIN (
       SELECT s.client_id, SUM(si.quantity * si.unit_price) AS totals
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       GROUP BY s.client_id
     ) s ON s.client_id = c.id
     LEFT JOIN (
       SELECT client_id, SUM(amount) AS total
       FROM payments
       GROUP BY client_id
     ) p ON p.client_id = c.id
     ORDER BY c.name COLLATE NOCASE`,
  ).map((row) => ({
    ...mapClient(row),
    totalSales: fromCents(row.total_sales),
    totalPayments: fromCents(row.total_payments),
    balance: fromCents(row.total_sales - row.total_payments),
  }))
}

export function getClient(id: string): Client | null {
  const row = get<ClientRow>('SELECT * FROM clients WHERE id = ?', [id])
  return row ? mapClient(row) : null
}

export function createClient(name: string): string {
  const id = uid()
  run('INSERT INTO clients (id, name, created_at) VALUES (?, ?, ?)', [id, name, nowIso()])
  return id
}

export function deleteClient(id: string): void {
  run('DELETE FROM clients WHERE id = ?', [id])
}

/** True when the client has sales or payments (FK-protected from deletion). */
export function clientInUse(id: string): boolean {
  const row = get<{ n: number }>(
    `SELECT
       (SELECT COUNT(*) FROM sales WHERE client_id = ?) +
       (SELECT COUNT(*) FROM payments WHERE client_id = ?) AS n`,
    [id, id],
  )
  return (row?.n ?? 0) > 0
}

export function listPayments(clientId?: string): PaymentWithContext[] {
  const rows = all<{
    id: string
    client_id: string
    sale_id: string | null
    amount: number
    note: string | null
    created_at: string
    client_name: string
    sale_label: string | null
  }>(
    `SELECT p.*, c.name AS client_name, t.name AS sale_label
     FROM payments p
     JOIN clients c ON c.id = p.client_id
     LEFT JOIN tandas t ON t.id = (
       SELECT s.tanda_id FROM sales s WHERE s.id = p.sale_id
     )
     ${clientId ? 'WHERE p.client_id = ?' : ''}
     ORDER BY p.created_at DESC`,
    clientId ? [clientId] : [],
  )
  return rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    saleId: row.sale_id,
    amount: fromCents(row.amount),
    note: row.note,
    createdAt: row.created_at,
    clientName: row.client_name,
    saleLabel: row.sale_label,
  }))
}

export interface PaymentInput {
  clientId: string
  /** Null = general abono applied to the client's overall balance. */
  saleId: string | null
  amount: number
  note: string | null
}

export function addPayment(input: PaymentInput): string {
  const id = uid()
  run(
    'INSERT INTO payments (id, client_id, sale_id, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, input.clientId, input.saleId, toCents(input.amount), input.note, nowIso()],
  )
  return id
}

export function deletePayment(id: string): void {
  run('DELETE FROM payments WHERE id = ?', [id])
}
