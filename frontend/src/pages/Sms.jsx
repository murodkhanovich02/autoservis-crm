import { ReloadOutlined, SendOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Form, Input, Popconfirm, Radio, Select, Space, Table, Tabs, Tooltip } from 'antd'
import { useState } from 'react'
import { del, errorText, get, post } from '../api'
import { useAuth } from '../auth'
import { CustomerSelect, PageHead, Plate, StatusTag } from '../components/common'
import { fmtDate, fmtDateTime, fmtNum, fmtPhone, REMINDER_STATUS, SMS_KINDS, SMS_STATUS, smsParts } from '../utils'

function History() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [status, setStatus] = useState()
  const [kind, setKind] = useState()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const params = { status, kind, skip: (page - 1) * pageSize, limit: pageSize }
  const { data, isFetching } = useQuery({
    queryKey: ['sms', params],
    queryFn: () => get('/sms', params),
    placeholderData: keepPreviousData,
  })

  const retry = async (m) => {
    try {
      await post(`/sms/${m.id}/retry`)
      message.success('Qayta yuborilmoqda')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['sms'] }), 1500)
    } catch (e) {
      message.error(errorText(e))
    }
  }

  return (
    <>
      <div className="toolbar">
        <Select
          placeholder="Holat"
          allowClear
          value={status}
          onChange={(v) => (setStatus(v), setPage(1))}
          options={Object.entries(SMS_STATUS).map(([value, s]) => ({ value, label: s.label }))}
          style={{ width: 160 }}
        />
        <Select
          placeholder="Turi"
          allowClear
          value={kind}
          onChange={(v) => (setKind(v), setPage(1))}
          options={Object.entries(SMS_KINDS).map(([value, label]) => ({ value, label }))}
          style={{ width: 180 }}
        />
        <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['sms'] })} />
      </div>
      <Table
        rowKey="id"
        size="small"
        loading={isFetching}
        dataSource={data?.items}
        scroll={{ x: 800 }}
        pagination={{ current: page, pageSize, total: data?.total, onChange: setPage, hideOnSinglePage: true }}
        columns={[
          { title: 'Sana', dataIndex: 'created_at', render: fmtDateTime, width: 140 },
          { title: 'Telefon', dataIndex: 'phone', render: fmtPhone, width: 160 },
          { title: 'Matn', dataIndex: 'text' },
          { title: 'Turi', dataIndex: 'kind', render: (k) => SMS_KINDS[k] || k, width: 120 },
          {
            title: 'Holat',
            dataIndex: 'status',
            width: 140,
            render: (s, m) => (
              <Space>
                <Tooltip title={m.error}>
                  <span>
                    <StatusTag status={s} map={SMS_STATUS} />
                  </span>
                </Tooltip>
                {s === 'failed' && <Button size="small" type="link" onClick={() => retry(m)}>Qayta</Button>}
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}

function Reminders() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [status, setStatus] = useState('pending')
  const [running, setRunning] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 50
  const params = { status, skip: (page - 1) * pageSize, limit: pageSize }
  const { data, isFetching } = useQuery({
    queryKey: ['reminders', params],
    queryFn: () => get('/reminders', params),
    placeholderData: keepPreviousData,
  })

  const run = async () => {
    setRunning(true)
    try {
      const r = await post('/reminders/run')
      message.success(`${r.queued} ta eslatma yuborildi`)
      qc.invalidateQueries({ queryKey: ['reminders'] })
      qc.invalidateQueries({ queryKey: ['sms'] })
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setRunning(false)
    }
  }

  const cancel = async (r) => {
    try {
      await del(`/reminders/${r.id}`)
      qc.invalidateQueries({ queryKey: ['reminders'] })
    } catch (e) {
      message.error(errorText(e))
    }
  }

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Buyurtma yopilganda, eslatma sozlangan xizmatlar (masalan, moy almashtirish) uchun keyingi sana avtomatik hisoblanadi. Sana kelganda mijozga SMS yuboriladi (ish vaqtida, har soatda)."
      />
      <div className="toolbar">
        <Radio.Group
          value={status}
          onChange={(e) => (setStatus(e.target.value), setPage(1))}
          optionType="button"
          options={[
            { value: 'pending', label: 'Kutilmoqda' },
            { value: 'sent', label: 'Yuborilgan' },
            { value: 'cancelled', label: 'Bekor qilingan' },
          ]}
        />
        <Popconfirm title="Muddati kelgan eslatmalar hozir yuborilsinmi?" onConfirm={run}>
          <Button type="primary" icon={<SendOutlined />} loading={running}>
            Hozir yuborish
          </Button>
        </Popconfirm>
      </div>
      <Table
        rowKey="id"
        size="small"
        loading={isFetching}
        dataSource={data?.items}
        scroll={{ x: 800 }}
        pagination={{ current: page, pageSize, total: data?.total, onChange: setPage, hideOnSinglePage: true }}
        columns={[
          { title: 'Sana', dataIndex: 'due_date', render: fmtDate, width: 110 },
          {
            title: 'Mijoz',
            render: (_, r) => (
              <>
                {r.customer.full_name}
                <div className="muted">{fmtPhone(r.customer.phone)}</div>
              </>
            ),
          },
          { title: 'Avtomobil', render: (_, r) => <Plate value={r.vehicle.plate_number} /> },
          { title: 'Xizmat', render: (_, r) => r.service.name },
          { title: 'Probeg', dataIndex: 'due_mileage', render: (v) => (v ? `${fmtNum(v)} km` : '—') },
          { title: 'Holat', dataIndex: 'status', render: (s) => <StatusTag status={s} map={REMINDER_STATUS} /> },
          { title: 'Yuborilgan', dataIndex: 'sent_at', render: fmtDateTime },
          status === 'pending' && {
            width: 90,
            render: (_, r) => (
              <Popconfirm title="Eslatma bekor qilinsinmi?" onConfirm={() => cancel(r)}>
                <Button size="small" type="link" danger>
                  Bekor
                </Button>
              </Popconfirm>
            ),
          },
        ].filter(Boolean)}
      />
    </>
  )
}

function SendForm() {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [sending, setSending] = useState(false)
  const text = Form.useWatch('text', form) || ''
  const target = Form.useWatch('target', form)

  const submit = async (v) => {
    setSending(true)
    try {
      const r = await post('/sms/send', {
        text: v.text,
        all_customers: v.target === 'all',
        customer_ids: v.target === 'customers' ? v.customer_ids || [] : [],
        phones: v.target === 'phones' ? (v.phones || '').split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean) : [],
      })
      message.success(`${r.queued} ta SMS yuborilmoqda`)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['sms'] })
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={submit} initialValues={{ target: 'customers' }} style={{ maxWidth: 640 }}>
      <Form.Item name="target" label="Kimga">
        <Radio.Group
          options={[
            { value: 'customers', label: 'Tanlangan mijozlar' },
            { value: 'phones', label: 'Telefon raqamlar' },
            { value: 'all', label: "Barcha mijozlar (SMS'ga rozi bo'lganlar)" },
          ]}
        />
      </Form.Item>
      {target === 'customers' && (
        <Form.Item name="customer_ids" rules={[{ required: true, message: 'Mijozlarni tanlang' }]}>
          <CustomerSelect mode="multiple" />
        </Form.Item>
      )}
      {target === 'phones' && (
        <Form.Item name="phones" rules={[{ required: true, message: 'Raqamlarni kiriting' }]} extra="Har bir raqam yangi qatorda yoki vergul bilan">
          <Input.TextArea rows={3} placeholder="901234567, 935554433" />
        </Form.Item>
      )}
      <Form.Item
        name="text"
        label="Xabar matni"
        rules={[{ required: true, min: 3 }]}
        extra={`${text.length} belgi · ${smsParts(text)} ta SMS qismi`}
      >
        <Input.TextArea rows={4} maxLength={700} placeholder="Hurmatli mijoz! Shu hafta moy almashtirishda 20% chegirma..." />
      </Form.Item>
      <Popconfirm title="SMS yuborilsinmi?" description="Har bir SMS uchun to'lov olinadi" onConfirm={form.submit}>
        <Button type="primary" icon={<SendOutlined />} loading={sending}>
          Yuborish
        </Button>
      </Popconfirm>
    </Form>
  )
}

export default function Sms() {
  const { isAdmin } = useAuth()
  return (
    <>
      <PageHead title="SMS xabarnomalar" />
      <Card size="small">
        <Tabs
          items={[
            { key: 'history', label: 'Yuborilgan SMS', children: <History /> },
            { key: 'reminders', label: 'Eslatmalar', children: <Reminders /> },
            isAdmin && { key: 'send', label: 'SMS yuborish', children: <SendForm /> },
          ].filter(Boolean)}
        />
      </Card>
    </>
  )
}
