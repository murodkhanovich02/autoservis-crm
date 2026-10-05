import dayjs from 'dayjs'

const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export const fmtNum = (v) => {
  const [int, frac] = String(+Number(v || 0).toFixed(3)).split('.')
  return group(int) + (frac ? ',' + frac : '')
}
export const money = (v) => `${group(Math.round(Number(v || 0)))} so'm`
export const moneyShort = (v) => {
  const n = Number(v || 0)
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1).replace('.0', '')} mln`
  if (Math.abs(n) >= 1e3) return `${Math.round(n / 1e3)} ming`
  return String(Math.round(n))
}

export const fmtDate = (v) => (v ? dayjs(v).format('DD.MM.YYYY') : '—')
export const fmtDateTime = (v) => (v ? dayjs(v).format('DD.MM.YYYY HH:mm') : '—')

export const fmtPhone = (v) => {
  const m = /^998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(v || '')
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : v || '—'
}

export const fmtPlate = (v) => {
  if (!v) return '—'
  let m = /^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/.exec(v)
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`
  m = /^(\d{2})(\d{3})([A-Z]{3})$/.exec(v)
  if (m) return `${m[1]} ${m[2]} ${m[3]}`
  return v
}

export const carName = (v) => [v?.brand, v?.model].filter(Boolean).join(' ') || '—'

// InputNumber uchun: 1250000 -> "1 250 000"
export const moneyInputProps = {
  formatter: (v) => (v === undefined || v === null || v === '' ? '' : group(v)),
  parser: (v) => (v || '').replace(/\s/g, ''),
  min: 0,
  step: 1000,
  style: { width: '100%' },
}

export const ORDER_STATUS = {
  new: { label: 'Yangi', color: 'blue' },
  in_progress: { label: 'Jarayonda', color: 'orange' },
  waiting_parts: { label: 'Zapchast kutilmoqda', color: 'gold' },
  ready: { label: 'Tayyor', color: 'green' },
  closed: { label: 'Topshirildi', color: 'default' },
  cancelled: { label: 'Bekor qilingan', color: 'red' },
}
export const OPEN_STATUSES = ['new', 'in_progress', 'waiting_parts', 'ready']

export const APPT_STATUS = {
  new: { label: 'Tasdiqlanmagan', color: 'blue' },
  confirmed: { label: 'Tasdiqlangan', color: 'cyan' },
  arrived: { label: 'Keldi', color: 'green' },
  completed: { label: 'Bajarildi', color: 'default' },
  cancelled: { label: 'Bekor qilindi', color: 'red' },
  no_show: { label: 'Kelmadi', color: 'volcano' },
}
export const APPT_SOURCE = { online: 'Onlayn', phone: 'Telefon', walk_in: "O'zi keldi" }

export const PAYMENT_METHODS = {
  cash: 'Naqd',
  card: 'Karta (Uzcard/Humo)',
  transfer: "Bank o'tkazmasi",
  click: 'Click',
  payme: 'Payme',
}

export const ROLES = {
  admin: { label: 'Rahbar (admin)', color: 'purple' },
  manager: { label: 'Administrator', color: 'blue' },
  mechanic: { label: 'Usta', color: 'orange' },
}

export const MOVEMENT_KINDS = {
  in: { label: 'Kirim', color: 'green' },
  order: { label: 'Buyurtmaga', color: 'blue' },
  return: { label: 'Qaytarildi', color: 'cyan' },
  adjust: { label: 'Inventarizatsiya', color: 'purple' },
}

export const SMS_KINDS = {
  appointment: 'Navbat',
  order_ready: 'Mashina tayyor',
  reminder: 'Eslatma',
  manual: "Qo'lda",
}

export const SMS_STATUS = {
  pending: { label: 'Navbatda', color: 'blue' },
  sent: { label: 'Yuborildi', color: 'green' },
  failed: { label: 'Xato', color: 'red' },
}

export const REMINDER_STATUS = {
  pending: { label: 'Kutilmoqda', color: 'blue' },
  sent: { label: 'Yuborildi', color: 'green' },
  cancelled: { label: 'Bekor', color: 'default' },
}

// SMS qismlari: lotin — 160 belgi (ko'p qismli 153), kirill — 70 (67)
export function smsParts(text = '') {
  if (!text.length) return 0
  const unicode = /[^\x00-\x7F]/.test(text) // eslint-disable-line no-control-regex
  const [one, many] = unicode ? [70, 67] : [160, 153]
  return text.length <= one ? 1 : Math.ceil(text.length / many)
}
