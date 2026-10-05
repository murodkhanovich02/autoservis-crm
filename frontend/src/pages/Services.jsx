import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, AutoComplete, Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { del, errorText, get, patch, post } from '../api'
import { useAuth } from '../auth'
import { PageHead } from '../components/common'
import { fmtNum, money, moneyInputProps } from '../utils'

function ServiceModal({ open, onClose, service }) {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const { data: categories = [] } = useQuery({ queryKey: ['services', 'categories'], queryFn: () => get('/services/categories') })

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (service) form.setFieldsValue({ ...service, price: Number(service.price) })
    }
  }, [open, service, form])

  const submit = async (v) => {
    setSaving(true)
    const payload = { ...v, reminder_months: v.reminder_months || null, reminder_km: v.reminder_km || null }
    try {
      if (service) await patch(`/services/${service.id}`, payload)
      else await post('/services', payload)
      qc.invalidateQueries({ queryKey: ['services'] })
      message.success('Saqlandi')
      onClose()
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={service ? 'Xizmatni tahrirlash' : 'Yangi xizmat'}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText="Saqlash"
      confirmLoading={saving}
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ duration_minutes: 60, is_active: true, price: 0 }}>
        <Form.Item name="name" label="Nomi" rules={[{ required: true, min: 2 }]}>
          <Input />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="category" label="Kategoriya">
              <AutoComplete
                options={categories.map((c) => ({ value: c }))}
                showSearch={{ filterOption: (input, o) => o.value.toLowerCase().includes(input.toLowerCase()) }}
                placeholder="Moy almashtirish"
              />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="price" label="Narx (so'm)" rules={[{ required: true }]}>
              <InputNumber {...moneyInputProps} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="duration_minutes" label="Davomiyligi (daq)">
              <InputNumber min={5} step={15} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Card size="small" title="Keyingi xizmat eslatmasi (SMS)" style={{ marginBottom: 16, background: '#fafbfc' }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            Masalan, moy almashtirish: 6 oy yoki 8 000 km. Buyurtma yopilganda mijozga avtomatik eslatma rejalashtiriladi.
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="reminder_months" label="Necha oydan keyin" style={{ marginBottom: 0 }}>
                <InputNumber min={1} max={60} style={{ width: '100%' }} placeholder="—" suffix="oy" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reminder_km" label="Necha km dan keyin" style={{ marginBottom: 0 }}>
                <InputNumber min={100} step={1000} style={{ width: '100%' }} placeholder="—" suffix="km" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
        <Form.Item name="description" label="Tavsif">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="is_active" label="Faol" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function Services() {
  const { isStaff } = useAuth()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState()
  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState({ open: false, service: null })
  const { data = [], isFetching } = useQuery({
    queryKey: ['services', { all: true }],
    queryFn: () => get('/services'),
  })

  const categories = [...new Set(data.map((s) => s.category).filter(Boolean))]
  const rows = data.filter(
    (s) =>
      (showInactive || s.is_active) &&
      (!category || s.category === category) &&
      (!q || s.name.toLowerCase().includes(q.toLowerCase())),
  )

  const remove = async (s) => {
    try {
      await del(`/services/${s.id}`)
      qc.invalidateQueries({ queryKey: ['services'] })
      message.success("O'chirildi")
    } catch (e) {
      message.error(errorText(e))
    }
  }

  return (
    <>
      <PageHead
        title="Xizmatlar va narxlar"
        extra={
          isStaff && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true, service: null })}>
              Yangi xizmat
            </Button>
          )
        }
      />
      <Card size="small">
        <div className="toolbar">
          <Input.Search placeholder="Qidirish" allowClear onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Select
            placeholder="Kategoriya"
            allowClear
            value={category}
            onChange={setCategory}
            options={categories.map((c) => ({ value: c, label: c }))}
            style={{ width: 220 }}
          />
          <Space>
            <Switch size="small" checked={showInactive} onChange={setShowInactive} /> Nofaollarni ko'rsatish
          </Space>
        </div>
        <Table
          rowKey="id"
          size="middle"
          loading={isFetching}
          dataSource={rows}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          scroll={{ x: 760 }}
          columns={[
            {
              title: 'Nomi',
              dataIndex: 'name',
              render: (v, s) => (
                <>
                  {v} {!s.is_active && <Tag>nofaol</Tag>}
                  {s.description && <div className="muted">{s.description}</div>}
                </>
              ),
            },
            { title: 'Kategoriya', dataIndex: 'category', render: (v) => (v ? <Tag>{v}</Tag> : '—') },
            { title: 'Narx', dataIndex: 'price', align: 'right', render: (v) => <b className="num">{money(v)}</b> },
            { title: 'Vaqt', dataIndex: 'duration_minutes', align: 'center', render: (v) => `${v} daq` },
            {
              title: 'Eslatma',
              render: (_, s) =>
                s.reminder_months || s.reminder_km ? (
                  <Tag color="blue">
                    {[s.reminder_months && `${s.reminder_months} oy`, s.reminder_km && `${fmtNum(s.reminder_km)} km`]
                      .filter(Boolean)
                      .join(' / ')}
                  </Tag>
                ) : (
                  '—'
                ),
            },
            isStaff && {
              width: 90,
              render: (_, s) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => setModal({ open: true, service: s })} />
                  <Popconfirm title="O'chirilsinmi?" description="Ishlatilgan xizmat nofaol qilinadi" onConfirm={() => remove(s)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ].filter(Boolean)}
        />
      </Card>
      <ServiceModal open={modal.open} service={modal.service} onClose={() => setModal({ open: false, service: null })} />
    </>
  )
}
