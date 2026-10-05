import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PhoneOutlined,
  PlusOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, errorText, get } from '../api'
import { useAuth } from '../auth'
import { Plate, StatusTag, serviceOptions, useMechanics, useServices } from '../components/common'
import {
  carName,
  fmtDate,
  fmtDateTime,
  fmtNum,
  fmtPhone,
  money,
  moneyInputProps,
  OPEN_STATUSES,
  ORDER_STATUS,
  PAYMENT_METHODS,
} from '../utils'

const NEXT_ACTIONS = {
  new: [
    { to: 'in_progress', label: 'Ishni boshlash', primary: true },
    { to: 'waiting_parts', label: 'Zapchast kutilmoqda' },
  ],
  in_progress: [
    { to: 'ready', label: 'Tayyor', primary: true },
    { to: 'waiting_parts', label: 'Zapchast kutilmoqda' },
  ],
  waiting_parts: [
    { to: 'in_progress', label: 'Ishni davom ettirish', primary: true },
    { to: 'ready', label: 'Tayyor' },
  ],
  ready: [
    { to: 'closed', label: 'Topshirish (yopish)', primary: true, staffOnly: true },
    { to: 'in_progress', label: 'Qayta ishga qaytarish' },
  ],
}

function useOrderMutation(orderId) {
  const qc = useQueryClient()
  const { message } = App.useApp()
  const m = useMutation({
    mutationFn: ({ method, url, data }) => api[method](url, data).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['order', orderId], data)
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['parts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => message.error(errorText(e)),
  })
  const run = (method, path, data, okText) =>
    m
      .mutateAsync({ method, url: `/orders/${orderId}${path}`, data })
      .then((r) => {
        if (okText) message.success(okText)
        return r
      })
      .catch(() => null)
  return { run, pending: m.isPending }
}

function AddServiceRow({ onAdd, mechanics, defaultMechanic }) {
  const [form] = Form.useForm()
  const { data: services = [] } = useServices()
  const serviceId = Form.useWatch('service_id', form)

  useEffect(() => {
    const s = services.find((x) => x.id === serviceId)
    if (s) form.setFieldValue('price', Number(s.price))
  }, [serviceId, services, form])

  const submit = async (v) => {
    const ok = await onAdd({
      service_id: v.service_id ?? null,
      name: v.service_id ? null : v.name,
      price: v.price,
      quantity: v.quantity || 1,
      mechanic_id: v.mechanic_id ?? null,
    })
    if (ok) form.resetFields()
  }

  return (
    <Form form={form} onFinish={submit} initialValues={{ quantity: 1, mechanic_id: defaultMechanic }} style={{ marginTop: 12 }}>
      <Row gutter={8}>
        <Col xs={24} md={9}>
          <Form.Item name="service_id" style={{ marginBottom: 8 }}>
            <Select
              placeholder="Katalogdan xizmat"
              allowClear
              showSearch={{ optionFilterProp: 'name' }}
              options={serviceOptions(services)}
            />
          </Form.Item>
          {!serviceId && (
            <Form.Item name="name" style={{ marginBottom: 8 }} rules={[{ required: true, message: 'Xizmatni tanlang yoki nomini yozing' }]}>
              <Input placeholder="...yoki boshqa ish nomi" />
            </Form.Item>
          )}
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="mechanic_id" style={{ marginBottom: 8 }}>
            <Select placeholder="Usta" allowClear options={mechanics.map((m) => ({ value: m.id, label: m.full_name }))} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="price" style={{ marginBottom: 8 }} rules={[{ required: true, message: 'Narx' }]}>
            <InputNumber {...moneyInputProps} placeholder="Narx" />
          </Form.Item>
        </Col>
        <Col xs={12} md={3}>
          <Form.Item name="quantity" style={{ marginBottom: 8 }}>
            <InputNumber min={0.1} step={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={3}>
          <Button type="primary" ghost htmlType="submit" icon={<PlusOutlined />} block>
            Qo'shish
          </Button>
        </Col>
      </Row>
    </Form>
  )
}

function AddPartRow({ onAdd }) {
  const [form] = Form.useForm()
  const [search, setSearch] = useState('')
  const { data } = useQuery({
    queryKey: ['parts', 'pick', search],
    queryFn: () => get('/parts', { q: search || undefined, limit: 30 }),
  })
  const parts = data?.items || []
  const partId = Form.useWatch('part_id', form)
  const selected = parts.find((p) => p.id === partId)

  useEffect(() => {
    if (selected) form.setFieldValue('price', Number(selected.sale_price))
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (v) => {
    const ok = await onAdd({ part_id: v.part_id, quantity: v.quantity, price: v.price })
    if (ok) form.resetFields()
  }

  return (
    <Form form={form} onFinish={submit} initialValues={{ quantity: 1 }} style={{ marginTop: 12 }}>
      <Row gutter={8}>
        <Col xs={24} md={11}>
          <Form.Item name="part_id" style={{ marginBottom: 8 }} rules={[{ required: true, message: 'Ehtiyot qismni tanlang' }]}>
            <Select
              placeholder="Ombordan qidirish (nomi yoki kodi)"
              showSearch={{ filterOption: false, onSearch: setSearch }}
              options={parts.map((p) => ({
                value: p.id,
                disabled: Number(p.quantity) <= 0,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>
                      {p.name} {p.code && <span className="muted">({p.code})</span>}
                    </span>
                    <span className="muted">
                      {fmtNum(p.quantity)} {p.unit}
                    </span>
                  </div>
                ),
              }))}
            />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="quantity" style={{ marginBottom: 8 }} rules={[{ required: true }]}>
            <InputNumber
              min={0.001}
              max={selected ? Number(selected.quantity) : undefined}
              step={1}
              style={{ width: '100%' }}
              suffix={selected?.unit}
            />
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="price" style={{ marginBottom: 8 }} rules={[{ required: true, message: 'Narx' }]}>
            <InputNumber {...moneyInputProps} placeholder="Sotuv narxi" />
          </Form.Item>
        </Col>
        <Col xs={24} md={4}>
          <Button type="primary" ghost htmlType="submit" icon={<PlusOutlined />} block>
            Qo'shish
          </Button>
        </Col>
      </Row>
    </Form>
  )
}

function PaymentForm({ debt, onPay }) {
  const [form] = Form.useForm()
  useEffect(() => {
    form.setFieldsValue({ amount: Math.round(debt), method: form.getFieldValue('method') || 'cash' })
  }, [debt, form])
  return (
    <Form form={form} layout="vertical" onFinish={(v) => onPay(v).then((ok) => ok && form.resetFields())} style={{ marginTop: 12 }}>
      <Row gutter={8}>
        <Col span={12}>
          <Form.Item name="amount" label="Summa" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
            <InputNumber {...moneyInputProps} max={debt} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="method" label="Usul" style={{ marginBottom: 8 }}>
            <Select options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="note" style={{ marginBottom: 8 }}>
        <Input placeholder="Izoh (ixtiyoriy)" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block style={{ background: '#15803d' }}>
        To'lov qabul qilish
      </Button>
    </Form>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const orderId = Number(id)
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const { isStaff, isAdmin } = useAuth()
  const { data: mechanics = [] } = useMechanics()
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => get(`/orders/${orderId}`),
  })
  const { run, pending } = useOrderMutation(orderId)

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (error) return <Result status="404" title="Buyurtma topilmadi" extra={<Button onClick={() => navigate('/orders')}>Buyurtmalar</Button>} />

  const editable = OPEN_STATUSES.includes(order.status)
  const canEdit = editable && isStaff
  const hasDebt = order.debt > 0 && order.status !== 'cancelled'

  const changeStatus = (to) => {
    if (to === 'ready') {
      let notify = true
      modal.confirm({
        title: 'Mashina tayyormi?',
        content: (
          <Checkbox defaultChecked onChange={(e) => (notify = e.target.checked)}>
            Mijozga SMS yuborish ({fmtPhone(order.customer.phone)})
          </Checkbox>
        ),
        okText: 'Ha, tayyor',
        cancelText: 'Yo‘q',
        onOk: () => run('post', '/status', { status: 'ready', notify }, 'Holat yangilandi'),
      })
    } else if (to === 'closed') {
      modal.confirm({
        title: 'Mashinani mijozga topshirish',
        content: hasDebt ? (
          <Typography.Text type="danger">
            Diqqat: to'lanmagan qarz qoladi — {money(order.debt)}. Baribir yopasizmi?
          </Typography.Text>
        ) : (
          "Buyurtma yopiladi va keyingi xizmat eslatmalari yaratiladi."
        ),
        okText: 'Topshirish',
        cancelText: 'Bekor',
        okButtonProps: { danger: hasDebt },
        onOk: () => run('post', '/status', { status: 'closed' }, 'Buyurtma yopildi'),
      })
    } else if (to === 'cancelled') {
      modal.confirm({
        title: 'Buyurtmani bekor qilish',
        content: "Ishlatilgan ehtiyot qismlar omborga qaytariladi. Davom etasizmi?",
        okText: 'Bekor qilish',
        okButtonProps: { danger: true },
        cancelText: 'Orqaga',
        onOk: () => run('post', '/status', { status: 'cancelled' }, 'Buyurtma bekor qilindi'),
      })
    } else {
      run('post', '/status', { status: to }, 'Holat yangilandi')
    }
  }

  const actions = (NEXT_ACTIONS[order.status] || []).filter((a) => !a.staffOnly || isStaff)

  return (
    <>
      <div className="page-head">
        <Space wrap align="center">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
          <h2>Buyurtma №{order.number}</h2>
          <StatusTag status={order.status} map={ORDER_STATUS} />
        </Space>
        <Space wrap>
          {actions.map((a) => (
            <Button key={a.to} type={a.primary ? 'primary' : 'default'} loading={pending} onClick={() => changeStatus(a.to)}>
              {a.label}
            </Button>
          ))}
          {isStaff && ['new', 'in_progress', 'waiting_parts'].includes(order.status) && (
            <Button danger onClick={() => changeStatus('cancelled')}>
              Bekor qilish
            </Button>
          )}
          <Button icon={<PrinterOutlined />} onClick={() => window.open(`/orders/${order.id}/print`, '_blank')}>
            Chop etish
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="Bajariladigan ishlar" size="small">
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={order.services}
              scroll={{ x: 560 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Xizmat qo'shilmagan" /> }}
              columns={[
                { title: 'Nomi', dataIndex: 'name' },
                { title: 'Usta', render: (_, r) => r.mechanic?.full_name || '—' },
                { title: 'Narx', dataIndex: 'price', align: 'right', render: (v) => <span className="num">{money(v)}</span> },
                { title: 'Soni', dataIndex: 'quantity', align: 'center', render: fmtNum },
                { title: 'Summa', dataIndex: 'amount', align: 'right', render: (v) => <b className="num">{money(v)}</b> },
                canEdit && {
                  width: 40,
                  render: (_, r) => (
                    <Popconfirm title="O'chirilsinmi?" onConfirm={() => run('delete', `/services/${r.id}`)}>
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                },
              ].filter(Boolean)}
            />
            {canEdit && (
              <AddServiceRow
                mechanics={mechanics}
                defaultMechanic={order.mechanic?.id}
                onAdd={(data) => run('post', '/services', data)}
              />
            )}
          </Card>

          <Card title="Ehtiyot qismlar" size="small" style={{ marginTop: 16 }}>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={order.parts}
              scroll={{ x: 480 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Ehtiyot qism ishlatilmagan" /> }}
              columns={[
                { title: 'Nomi', dataIndex: 'name' },
                { title: 'Soni', dataIndex: 'quantity', align: 'center', render: fmtNum },
                { title: 'Narx', dataIndex: 'price', align: 'right', render: (v) => <span className="num">{money(v)}</span> },
                { title: 'Summa', dataIndex: 'amount', align: 'right', render: (v) => <b className="num">{money(v)}</b> },
                canEdit && {
                  width: 40,
                  render: (_, r) => (
                    <Popconfirm title="Omborga qaytarilsinmi?" onConfirm={() => run('delete', `/parts/${r.id}`)}>
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                },
              ].filter(Boolean)}
            />
            {canEdit && <AddPartRow onAdd={(data) => run('post', '/parts', data)} />}
          </Card>

          <Card title="Izohlar" size="small" style={{ marginTop: 16 }}>
            <Typography.Text type="secondary">Mijoz shikoyati:</Typography.Text>
            <Typography.Paragraph
              editable={canEdit ? { onChange: (v) => v !== (order.complaint || '') && run('patch', '', { complaint: v }) } : false}
            >
              {order.complaint || ''}
            </Typography.Paragraph>
            <Typography.Text type="secondary">Usta xulosasi / bajarilgan ishlar:</Typography.Text>
            <Typography.Paragraph
              editable={editable ? { onChange: (v) => v !== (order.diagnosis || '') && run('patch', '', { diagnosis: v }) } : false}
            >
              {order.diagnosis || ''}
            </Typography.Paragraph>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card size="small" title="Mijoz va avtomobil">
            <Descriptions
              column={1}
              size="small"
              items={[
                { label: 'Mijoz', children: <Link to={`/customers/${order.customer.id}`}>{order.customer.full_name}</Link> },
                {
                  label: 'Telefon',
                  children: (
                    <a href={`tel:+${order.customer.phone}`}>
                      <PhoneOutlined /> {fmtPhone(order.customer.phone)}
                    </a>
                  ),
                },
                {
                  label: 'Avtomobil',
                  children: (
                    <Space>
                      <Plate value={order.vehicle.plate_number} /> {carName(order.vehicle)}
                    </Space>
                  ),
                },
                {
                  label: 'Probeg',
                  children: editable ? (
                    <InputNumber
                      size="small"
                      defaultValue={order.mileage}
                      key={order.mileage}
                      min={0}
                      step={1000}
                      suffix="km"
                      style={{ width: 150 }}
                      onBlur={(e) => {
                        const v = Number(String(e.target.value).replace(/\D/g, '')) || null
                        if (v !== order.mileage) run('patch', '', { mileage: v })
                      }}
                    />
                  ) : order.mileage ? (
                    `${fmtNum(order.mileage)} km`
                  ) : (
                    '—'
                  ),
                },
                {
                  label: 'Usta',
                  children: canEdit ? (
                    <Select
                      size="small"
                      value={order.mechanic?.id}
                      allowClear
                      placeholder="Tanlanmagan"
                      style={{ width: 180 }}
                      options={mechanics.map((m) => ({ value: m.id, label: m.full_name }))}
                      onChange={(v) => run('patch', '', { mechanic_id: v ?? null })}
                    />
                  ) : (
                    order.mechanic?.full_name || '—'
                  ),
                },
                { label: 'Ochilgan', children: fmtDateTime(order.created_at) },
                order.ready_at && { label: 'Tayyor bo‘ldi', children: fmtDateTime(order.ready_at) },
                order.closed_at && { label: 'Topshirildi', children: fmtDateTime(order.closed_at) },
              ].filter(Boolean)}
            />
          </Card>

          <Card size="small" title="Hisob-kitob" style={{ marginTop: 16 }}>
            <div className="totals-row">
              <span>Xizmatlar</span>
              <span className="num">{money(order.services_total)}</span>
            </div>
            <div className="totals-row">
              <span>Ehtiyot qismlar</span>
              <span className="num">{money(order.parts_total)}</span>
            </div>
            <div className="totals-row" style={{ alignItems: 'center' }}>
              <span>Chegirma</span>
              {canEdit ? (
                <InputNumber
                  {...moneyInputProps}
                  size="small"
                  key={order.discount}
                  defaultValue={Number(order.discount)}
                  style={{ width: 140 }}
                  onBlur={(e) => {
                    const v = Number(String(e.target.value).replace(/\s/g, '')) || 0
                    if (v !== Number(order.discount)) run('patch', '', { discount: v })
                  }}
                />
              ) : (
                <span className="num">{money(order.discount)}</span>
              )}
            </div>
            <div className="totals-row big">
              <span>Jami</span>
              <span className="num">{money(order.total)}</span>
            </div>
            <div className="totals-row">
              <span>To'langan</span>
              <span className="num" style={{ color: '#15803d' }}>
                {money(order.paid)}
              </span>
            </div>
            <div className="totals-row" style={{ fontWeight: 600 }}>
              <span>Qarz</span>
              <span className="num" style={{ color: hasDebt ? '#dc2626' : undefined }}>
                {money(order.debt)}
              </span>
            </div>

            {order.payments.length > 0 && (
              <Table
                style={{ marginTop: 12 }}
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={order.payments}
                columns={[
                  { title: 'Sana', dataIndex: 'created_at', render: fmtDateTime },
                  { title: 'Usul', dataIndex: 'method', render: (m) => PAYMENT_METHODS[m] },
                  { title: 'Summa', dataIndex: 'amount', align: 'right', render: (v) => <span className="num">{money(v)}</span> },
                  isAdmin && {
                    width: 32,
                    render: (_, r) => (
                      <Popconfirm title="To'lov o'chirilsinmi?" onConfirm={() => run('delete', `/payments/${r.id}`)}>
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ),
                  },
                ].filter(Boolean)}
              />
            )}
            {isStaff && hasDebt && (
              <PaymentForm debt={Number(order.debt)} onPay={(v) => run('post', '/payments', v, "To'lov qabul qilindi")} />
            )}
          </Card>

          {order.reminders.length > 0 && (
            <Card size="small" title="Keyingi xizmat" style={{ marginTop: 16 }}>
              {order.reminders.map((r) => (
                <div key={r.id} style={{ marginBottom: 6 }}>
                  <b>{r.service.name}</b>
                  <div className="muted">
                    {fmtDate(r.due_date)}
                    {r.due_mileage ? ` yoki ${fmtNum(r.due_mileage)} km` : ''} — SMS eslatma yuboriladi
                  </div>
                </div>
              ))}
            </Card>
          )}
        </Col>
      </Row>
    </>
  )
}
