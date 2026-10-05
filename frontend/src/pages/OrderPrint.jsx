import { PrinterOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Spin } from 'antd'
import { useParams } from 'react-router-dom'
import { get } from '../api'
import { carName, fmtDate, fmtDateTime, fmtNum, fmtPhone, fmtPlate, money, ORDER_STATUS, PAYMENT_METHODS } from '../utils'

const cell = { border: '1px solid #333', padding: '4px 8px', fontSize: 13 }
const head = { ...cell, background: '#f0f0f0', fontWeight: 600 }

function Lines({ title, rows }) {
  if (!rows.length) return null
  return (
    <>
      <h4 style={{ margin: '16px 0 6px' }}>{title}</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...head, width: 30 }}>№</th>
            <th style={{ ...head, textAlign: 'left' }}>Nomi</th>
            <th style={{ ...head, width: 70 }}>Soni</th>
            <th style={{ ...head, width: 120 }}>Narx</th>
            <th style={{ ...head, width: 130 }}>Summa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>
              <td style={cell}>{r.name}</td>
              <td style={{ ...cell, textAlign: 'center' }}>{fmtNum(r.quantity)}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{money(r.price)}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{money(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export default function OrderPrint() {
  const { id } = useParams()
  const { data: order } = useQuery({ queryKey: ['order', Number(id)], queryFn: () => get(`/orders/${id}`) })
  const { data: info } = useQuery({ queryKey: ['public-info'], queryFn: () => get('/public/info') })

  if (!order || !info) return <Spin style={{ display: 'block', margin: '100px auto' }} />

  const row = (label, value, bold) => (
    <tr>
      <td style={{ padding: '2px 0', color: '#444' }}>{label}</td>
      <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: bold ? 700 : 400 }}>{value}</td>
    </tr>
  )

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div className="no-print" style={{ padding: 12, textAlign: 'center', background: '#f3f5f8' }}>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Chop etish
        </Button>
      </div>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 28px', color: '#111', fontSize: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111', paddingBottom: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{info.company_name}</div>
            <div>{info.company_address}</div>
            <div>Tel: {info.company_phone}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>ZAKAZ-NARYAD №{order.number}</div>
            <div>Sana: {fmtDateTime(order.created_at)}</div>
            <div>Holat: {ORDER_STATUS[order.status]?.label}</div>
          </div>
        </div>

        <table style={{ width: '100%', marginTop: 12 }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'top', width: '50%' }}>
                <b>Mijoz:</b> {order.customer.full_name}
                <br />
                <b>Telefon:</b> {fmtPhone(order.customer.phone)}
              </td>
              <td style={{ verticalAlign: 'top' }}>
                <b>Avtomobil:</b> {carName(order.vehicle)} {order.vehicle.year || ''}
                <br />
                <b>Davlat raqami:</b> {fmtPlate(order.vehicle.plate_number)}
                <br />
                <b>Probeg:</b> {order.mileage ? `${fmtNum(order.mileage)} km` : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        {order.complaint && (
          <p style={{ margin: '10px 0 0' }}>
            <b>Mijoz shikoyati:</b> {order.complaint}
          </p>
        )}
        {order.diagnosis && (
          <p style={{ margin: '4px 0 0' }}>
            <b>Usta xulosasi:</b> {order.diagnosis}
          </p>
        )}

        <Lines title="Bajarilgan ishlar" rows={order.services} />
        <Lines title="Ehtiyot qismlar va materiallar" rows={order.parts} />

        <table style={{ marginLeft: 'auto', marginTop: 12, minWidth: 300 }}>
          <tbody>
            {row('Xizmatlar:', money(order.services_total))}
            {row('Ehtiyot qismlar:', money(order.parts_total))}
            {Number(order.discount) > 0 && row('Chegirma:', '−' + money(order.discount))}
            {row('JAMI:', money(order.total), true)}
            {row("To'langan:", money(order.paid))}
            {order.payments.length > 0 &&
              row('', [...new Set(order.payments.map((p) => PAYMENT_METHODS[p.method]))].join(', '))}
            {Number(order.debt) > 0 && row('Qarz:', money(order.debt), true)}
          </tbody>
        </table>

        {order.reminders.length > 0 && (
          <div style={{ marginTop: 16, padding: 10, border: '1px dashed #333' }}>
            <b>Keyingi xizmat:</b>
            {order.reminders.map((r) => (
              <div key={r.id}>
                {r.service.name}: {fmtDate(r.due_date)}
                {r.due_mileage ? ` yoki ${fmtNum(r.due_mileage)} km` : ''}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, gap: 24 }}>
          <div style={{ flex: 1 }}>
            Usta: {order.mechanic?.full_name || ''}
            <div style={{ borderBottom: '1px solid #111', marginTop: 28 }} />
          </div>
          <div style={{ flex: 1 }}>
            Mijoz (ishlarni qabul qildim, e'tirozim yo'q):
            <div style={{ borderBottom: '1px solid #111', marginTop: 28 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
