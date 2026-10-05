import { CopyOutlined, EditOutlined, LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { errorText, get, patch, post } from '../api'
import { useAuth } from '../auth'
import { CustomerSelect, PageHead, Plate, serviceOptions, useServices } from '../components/common'
import { APPT_SOURCE, APPT_STATUS, carName, fmtPhone } from '../utils'

function AppointmentModal({ open, onClose, appointment, defaultDay }) {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const { data: services = [] } = useServices()
  const day = Form.useWatch('day', form)
  const { data: slots = [] } = useQuery({
    queryKey: ['slots', day?.format('YYYY-MM-DD')],
    queryFn: () => get('/appointments/slots', { day: day.format('YYYY-MM-DD') }),
    enabled: Boolean(open && day),
  })

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (appointment) {
      const at = dayjs(appointment.scheduled_at)
      form.setFieldsValue({
        ...appointment,
        phone: appointment.phone.replace(/^998/, ''),
        service_id: appointment.service?.id,
        day: at,
        time: at.format('HH:mm'),
      })
    } else {
      form.setFieldsValue({ day: defaultDay, notify: true })
    }
  }, [open, appointment, defaultDay, form])

  const timeOptions = slots.map((s) => ({
    value: s.time,
    label: `${s.time}  ·  ${s.free > 0 ? `${s.free} ta bo'sh` : 'band'}`,
  }))
  const currentTime = appointment ? dayjs(appointment.scheduled_at).format('HH:mm') : null
  if (currentTime && !timeOptions.some((o) => o.value === currentTime)) {
    timeOptions.unshift({ value: currentTime, label: currentTime })
  }

  const fillFromCustomer = (c) => {
    if (!c) return
    const v = c.vehicles?.[0]
    form.setFieldsValue({
      customer_name: c.full_name,
      phone: c.phone.replace(/^998/, ''),
      plate_number: v?.plate_number,
      car_info: v ? carName(v) : undefined,
    })
  }

  const submit = async (v) => {
    setSaving(true)
    const payload = {
      customer_id: v.customer_id,
      customer_name: v.customer_name,
      phone: v.phone,
      plate_number: v.plate_number,
      car_info: v.car_info,
      service_id: v.service_id ?? null,
      note: v.note,
      notify: v.notify,
      scheduled_at: `${v.day.format('YYYY-MM-DD')}T${v.time}:00`,
    }
    try {
      if (appointment) await patch(`/appointments/${appointment.id}`, payload)
      else await post('/appointments', { ...payload, source: v.source || 'phone' })
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['slots'] })
      message.success(appointment ? 'Saqlandi' : 'Navbatga yozildi')
      onClose()
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={appointment ? 'Navbatni tahrirlash' : 'Navbatga yozish'}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText="Saqlash"
      confirmLoading={saving}
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        {!appointment && (
          <Form.Item name="customer_id" label="Mavjud mijoz (ixtiyoriy)">
            <CustomerSelect onCustomer={fillFromCustomer} />
          </Form.Item>
        )}
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="customer_name" label="Ism" rules={[{ required: true, min: 2 }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="phone" label="Telefon" rules={[{ required: true }]}>
              <Input prefix="+998" placeholder="90 123 45 67" />
            </Form.Item>
          </Col>
          <Col xs={12}>
            <Form.Item name="plate_number" label="Davlat raqami" normalize={(v) => v?.toUpperCase()}>
              <Input placeholder="01 A 123 BC" />
            </Form.Item>
          </Col>
          <Col xs={12}>
            <Form.Item name="car_info" label="Avtomobil">
              <Input placeholder="Chevrolet Cobalt" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="service_id" label="Xizmat">
              <Select allowClear showSearch={{ optionFilterProp: 'name' }} options={serviceOptions(services)} />
            </Form.Item>
          </Col>
          <Col xs={12}>
            <Form.Item name="day" label="Sana" rules={[{ required: true }]}>
              <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} onChange={() => form.setFieldValue('time', undefined)} />
            </Form.Item>
          </Col>
          <Col xs={12}>
            <Form.Item name="time" label="Vaqt" rules={[{ required: true, message: 'Vaqtni tanlang' }]}>
              <Select options={timeOptions} placeholder={slots.length ? 'Tanlang' : "Bo'sh vaqt yo'q"} />
            </Form.Item>
          </Col>
          {!appointment && (
            <Col xs={24}>
              <Form.Item name="source" label="Qayerdan" initialValue="phone">
                <Select
                  options={[
                    { value: 'phone', label: "Telefon qo'ng'iroq" },
                    { value: 'walk_in', label: "O'zi keldi" },
                  ]}
                />
              </Form.Item>
            </Col>
          )}
          <Col xs={24}>
            <Form.Item name="note" label="Izoh">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="notify" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Mijozga SMS orqali tasdiq yuborish</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function Appointments() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { isStaff } = useAuth()
  const [day, setDay] = useState(dayjs())
  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(params.get('new') === '1')
  const [converting, setConverting] = useState(null)

  const dayKey = day.format('YYYY-MM-DD')
  const { data = [], isFetching } = useQuery({
    queryKey: ['appointments', dayKey],
    queryFn: () => get('/appointments', { day: dayKey }),
    refetchInterval: 60_000,
  })
  const { data: pending = [] } = useQuery({
    queryKey: ['appointments', 'pending'],
    queryFn: () => get('/appointments', { day: dayjs().format('YYYY-MM-DD'), date_to: dayjs().add(30, 'day').format('YYYY-MM-DD'), status: 'new' }),
    refetchInterval: 60_000,
  })

  const openModal = (appt = null) => {
    setEditing(appt)
    setModalOpen(true)
  }
  const closeModal = () => {
    setModalOpen(false)
    if (params.get('new')) setParams({}, { replace: true })
  }

  const setStatus = async (appt, status) => {
    try {
      await patch(`/appointments/${appt.id}`, { status, notify: true })
      qc.invalidateQueries({ queryKey: ['appointments'] })
      message.success(status === 'confirmed' ? 'Tasdiqlandi, mijozga SMS yuborildi' : 'Holat yangilandi')
    } catch (e) {
      message.error(errorText(e))
    }
  }

  const toOrder = async (appt) => {
    setConverting(appt.id)
    try {
      const { order_id } = await post(`/appointments/${appt.id}/to-order`)
      qc.invalidateQueries({ queryKey: ['appointments'] })
      navigate(`/orders/${order_id}`)
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setConverting(null)
    }
  }

  const bookingUrl = `${window.location.origin}/booking`
  const columns = [
    { title: 'Vaqt', dataIndex: 'scheduled_at', width: 70, render: (v) => <b style={{ fontSize: 15 }}>{dayjs(v).format('HH:mm')}</b> },
    {
      title: 'Mijoz',
      render: (_, r) => (
        <>
          <div>
            {r.customer_name} {r.source === 'online' && <Tag color="purple">onlayn</Tag>}
          </div>
          <a className="muted" href={`tel:+${r.phone}`}>
            {fmtPhone(r.phone)}
          </a>
        </>
      ),
    },
    {
      title: 'Avtomobil',
      render: (_, r) => (
        <>
          <Plate value={r.plate_number} />
          <div className="muted">{r.car_info}</div>
        </>
      ),
    },
    {
      title: 'Xizmat',
      render: (_, r) => (
        <>
          {r.service?.name || '—'}
          {r.note && <div className="muted">{r.note}</div>}
        </>
      ),
    },
    { title: 'Manba', dataIndex: 'source', render: (s) => APPT_SOURCE[s] || s },
    {
      title: 'Holat',
      dataIndex: 'status',
      width: 170,
      render: (s, r) => (
        <Select
          size="small"
          value={s}
          style={{ width: 160 }}
          disabled={Boolean(r.order_id)}
          onChange={(v) => setStatus(r, v)}
          options={Object.entries(APPT_STATUS).map(([value, x]) => ({ value, label: <Tag color={x.color}>{x.label}</Tag> }))}
        />
      ),
    },
    {
      width: 190,
      render: (_, r) => (
        <Space>
          {r.order_id ? (
            <Button size="small" onClick={() => navigate(`/orders/${r.order_id}`)}>
              Buyurtma
            </Button>
          ) : (
            isStaff &&
            !['cancelled', 'no_show'].includes(r.status) && (
              <Button size="small" type="primary" loading={converting === r.id} onClick={() => toOrder(r)}>
                Keldi → buyurtma
              </Button>
            )
          )}
          {isStaff && <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />}
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageHead
        title="Navbat"
        extra={
          <>
            <Tooltip title={bookingUrl}>
              <Button
                icon={<CopyOutlined />}
                onClick={() => navigator.clipboard?.writeText(bookingUrl).then(() => message.success('Havola nusxalandi'))}
              >
                Onlayn yozilish havolasi
              </Button>
            </Tooltip>
            {isStaff && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                Navbatga yozish
              </Button>
            )}
          </>
        }
      />

      {pending.length > 0 && (
        <Card
          size="small"
          title={`Tasdiqlanmagan onlayn yozilishlar (${pending.length})`}
          style={{ marginBottom: 16, borderColor: '#91caff' }}
        >
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={pending}
            scroll={{ x: 700 }}
            columns={[
              { title: 'Sana', dataIndex: 'scheduled_at', render: (v) => <b>{dayjs(v).format('DD.MM HH:mm')}</b> },
              ...columns.slice(1, 4),
              {
                render: (_, r) => (
                  <Space>
                    <Button size="small" type="primary" onClick={() => setStatus(r, 'confirmed')}>
                      Tasdiqlash
                    </Button>
                    <Button size="small" danger onClick={() => setStatus(r, 'cancelled')}>
                      Rad etish
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}

      <Card size="small">
        <div className="toolbar">
          <Space.Compact>
            <Button icon={<LeftOutlined />} onClick={() => setDay(day.subtract(1, 'day'))} />
            <DatePicker value={day} onChange={(d) => d && setDay(d)} format="dddd, DD.MM.YYYY" allowClear={false} style={{ width: 210 }} />
            <Button icon={<RightOutlined />} onClick={() => setDay(day.add(1, 'day'))} />
          </Space.Compact>
          <Button onClick={() => setDay(dayjs())}>Bugun</Button>
          <span className="muted" style={{ alignSelf: 'center' }}>
            Jami: {data.filter((a) => !['cancelled', 'no_show'].includes(a.status)).length} ta
          </span>
        </div>
        <Table rowKey="id" loading={isFetching} dataSource={data} columns={columns} pagination={false} scroll={{ x: 1000 }} />
      </Card>

      <AppointmentModal open={modalOpen} onClose={closeModal} appointment={editing} defaultDay={day} />
    </>
  )
}
