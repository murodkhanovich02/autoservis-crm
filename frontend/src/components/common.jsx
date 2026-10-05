import { useQuery } from '@tanstack/react-query'
import { Select, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { get } from '../api'
import { fmtPhone, fmtPlate, money } from '../utils'

export function PageHead({ title, extra, children }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {children}
      </div>
      {extra && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{extra}</div>}
    </div>
  )
}

export function StatusTag({ status, map }) {
  const s = map[status] || { label: status, color: 'default' }
  return (
    <Tag color={s.color} style={{ marginInlineEnd: 0 }}>
      {s.label}
    </Tag>
  )
}

export function Plate({ value }) {
  return value ? <span className="plate">{fmtPlate(value)}</span> : '—'
}

export function useServices(active = true) {
  return useQuery({
    queryKey: ['services', { active }],
    queryFn: () => get('/services', active === null ? {} : { active }),
    staleTime: 60_000,
  })
}

export function serviceOptions(services = []) {
  const groups = {}
  for (const s of services) {
    const cat = s.category || 'Boshqa'
    ;(groups[cat] ||= []).push({ value: s.id, label: `${s.name} — ${money(s.price)}`, name: s.name })
  }
  return Object.entries(groups).map(([label, options]) => ({ label, options }))
}

export function useMechanics() {
  return useQuery({
    queryKey: ['users', 'mechanics'],
    queryFn: () => get('/users', { active: true }),
    staleTime: 60_000,
    select: (users) => users.filter((u) => u.role === 'mechanic' || u.role === 'admin'),
  })
}

function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

/** Mijozni ism, telefon yoki davlat raqami bo'yicha qidirish */
export function CustomerSelect({ value, onChange, onCustomer, initialCustomer, ...rest }) {
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const { data, isFetching } = useQuery({
    queryKey: ['customers', 'search', q],
    queryFn: () => get('/customers', { q, limit: 15 }),
  })
  const list = [...(data?.items || [])]
  if (initialCustomer && !list.some((c) => c.id === initialCustomer.id)) list.unshift(initialCustomer)
  const options = list.map((c) => ({
    value: c.id,
    label: (
      <div>
        <div>{c.full_name}</div>
        <div className="muted">
          {fmtPhone(c.phone)}
          {c.vehicles?.length ? ' · ' + c.vehicles.map((v) => fmtPlate(v.plate_number)).join(', ') : ''}
        </div>
      </div>
    ),
    text: c.full_name,
    customer: c,
  }))
  return (
    <Select
      value={value}
      placeholder="Ism, telefon yoki davlat raqami..."
      showSearch={{ filterOption: false, onSearch: setSearch }}
      loading={isFetching}
      options={options}
      optionLabelProp="text"
      notFoundContent={isFetching ? 'Qidirilmoqda...' : 'Topilmadi'}
      onChange={(id, opt) => {
        onChange?.(id)
        onCustomer?.(opt?.customer || null)
      }}
      allowClear
      {...rest}
    />
  )
}
