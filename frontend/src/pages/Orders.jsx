import { PlusOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Card, Checkbox, DatePicker, Input, Select, Table, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { get } from '../api'
import { useAuth } from '../auth'
import { PageHead, Plate, StatusTag, useMechanics } from '../components/common'
import { carName, fmtDateTime, fmtPhone, money, OPEN_STATUSES, ORDER_STATUS } from '../utils'

const STATUS_FILTERS = [
  { value: 'open', label: 'Faol buyurtmalar' },
  { value: 'all', label: 'Hammasi' },
  ...Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label })),
]

export default function Orders() {
  const navigate = useNavigate()
  const { isStaff, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [range, setRange] = useState(null)
  const [page, setPage] = useState(1)
  const statusFilter = params.get('status') || (params.get('debt') ? 'all' : 'open')
  const debtOnly = params.get('debt') === '1'
  const mechanicId = params.get('mechanic') ? Number(params.get('mechanic')) : undefined
  const { data: mechanics = [] } = useMechanics()

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === undefined || value === null || value === '' || value === false) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
    setPage(1)
  }

  const pageSize = 20
  const query = {
    status: statusFilter === 'open' ? OPEN_STATUSES : statusFilter === 'all' ? undefined : [statusFilter],
    q: params.get('q') || undefined,
    mechanic_id: mechanicId,
    debt_only: debtOnly || undefined,
    date_from: range?.[0]?.format('YYYY-MM-DD'),
    date_to: range?.[1]?.format('YYYY-MM-DD'),
    skip: (page - 1) * pageSize,
    limit: pageSize,
  }
  const { data, isFetching } = useQuery({
    queryKey: ['orders', query],
    queryFn: () => get('/orders', query),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHead
        title="Buyurtmalar"
        extra={
          isStaff && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/orders/new')}>
              Yangi buyurtma
            </Button>
          )
        }
      />
      <Card size="small">
        <div className="toolbar">
          <Input.Search
            placeholder="№, mijoz, telefon yoki davlat raqami"
            allowClear
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onSearch={(v) => setParam('q', v.trim())}
            style={{ width: 300, maxWidth: '100%' }}
          />
          <Select
            value={statusFilter}
            options={STATUS_FILTERS}
            onChange={(v) => setParam('status', v === 'open' ? null : v)}
            style={{ width: 200 }}
          />
          <Select
            value={mechanicId}
            placeholder="Usta"
            allowClear
            options={[
              ...(user?.role === 'mechanic' ? [{ value: user.id, label: 'Mening buyurtmalarim' }] : []),
              ...mechanics.filter((m) => m.id !== user?.id).map((m) => ({ value: m.id, label: m.full_name })),
            ]}
            onChange={(v) => setParam('mechanic', v)}
            style={{ width: 200 }}
          />
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => {
              setRange(v)
              setPage(1)
            }}
            format="DD.MM.YYYY"
            presets={[
              { label: 'Bugun', value: [dayjs(), dayjs()] },
              { label: 'Shu hafta', value: [dayjs().startOf('week'), dayjs()] },
              { label: 'Shu oy', value: [dayjs().startOf('month'), dayjs()] },
            ]}
          />
          <Checkbox checked={debtOnly} onChange={(e) => setParam('debt', e.target.checked ? '1' : null)} style={{ alignSelf: 'center' }}>
            Faqat qarzdorlar
          </Checkbox>
        </div>
        <Table
          rowKey="id"
          size="middle"
          loading={isFetching}
          dataSource={data?.items}
          scroll={{ x: 900 }}
          rowClassName="clickable-row"
          onRow={(r) => ({ onClick: () => navigate(`/orders/${r.id}`) })}
          pagination={{
            current: page,
            pageSize,
            total: data?.total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (t) => `Jami: ${t}`,
          }}
          columns={[
            { title: '№', dataIndex: 'number', width: 80, render: (v) => <b>{v}</b> },
            { title: 'Sana', dataIndex: 'created_at', width: 140, render: fmtDateTime },
            {
              title: 'Mijoz',
              render: (_, r) => (
                <>
                  <div>{r.customer.full_name}</div>
                  <div className="muted">{fmtPhone(r.customer.phone)}</div>
                </>
              ),
            },
            {
              title: 'Avtomobil',
              render: (_, r) => (
                <>
                  <Plate value={r.vehicle.plate_number} />
                  <div className="muted">{carName(r.vehicle)}</div>
                </>
              ),
            },
            { title: 'Usta', render: (_, r) => r.mechanic?.full_name || '—' },
            { title: 'Holat', dataIndex: 'status', render: (s) => <StatusTag status={s} map={ORDER_STATUS} /> },
            { title: 'Summa', dataIndex: 'total', align: 'right', render: (v) => <span className="num">{money(v)}</span> },
            {
              title: 'Qarz',
              dataIndex: 'debt',
              align: 'right',
              render: (v, r) =>
                v > 0 && r.status !== 'cancelled' ? (
                  <Typography.Text type="danger" className="num">
                    {money(v)}
                  </Typography.Text>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>
    </>
  )
}
