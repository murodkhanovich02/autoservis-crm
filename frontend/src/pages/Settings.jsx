import { CopyOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Form, Input, InputNumber, Row, Skeleton, Switch, TimePicker, Typography } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { errorText, get, put } from '../api'
import { PageHead } from '../components/common'
import { smsParts } from '../utils'

const TEMPLATES = [
  {
    key: 'sms_appointment',
    toggle: 'sms_appointment_enabled',
    title: 'Navbat tasdiqlanganda',
    vars: '{name} {date} {time} {service} {plate} {company} {company_phone}',
  },
  {
    key: 'sms_order_ready',
    toggle: 'sms_order_ready_enabled',
    title: 'Mashina tayyor bo‘lganda',
    vars: '{name} {plate} {total} {debt} {number} {company} {company_phone}',
  },
  {
    key: 'sms_reminder',
    toggle: 'sms_reminder_enabled',
    title: 'Keyingi xizmat eslatmasi',
    vars: '{name} {plate} {service} {mileage} {company} {company_phone}',
  },
]

function TemplateHint({ form, name }) {
  const text = Form.useWatch(name, form) || ''
  return (
    <span className="muted">
      {text.length} belgi · {smsParts(text)} SMS
    </span>
  )
}

export default function Settings() {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => get('/settings') })

  useEffect(() => {
    if (!data) return
    form.setFieldsValue({
      ...data,
      work_start: dayjs(data.work_start, 'HH:mm'),
      work_end: dayjs(data.work_end, 'HH:mm'),
      slot_minutes: Number(data.slot_minutes),
      posts_count: Number(data.posts_count),
      ...Object.fromEntries(TEMPLATES.map((t) => [t.toggle, data[t.toggle] === '1'])),
    })
  }, [data, form])

  const submit = async (v) => {
    setSaving(true)
    const payload = {
      ...v,
      work_start: v.work_start.format('HH:mm'),
      work_end: v.work_end.format('HH:mm'),
      slot_minutes: String(v.slot_minutes),
      posts_count: String(v.posts_count),
      ...Object.fromEntries(TEMPLATES.map((t) => [t.toggle, v[t.toggle] ? '1' : '0'])),
    }
    try {
      const saved = await put('/settings', payload)
      qc.setQueryData(['settings'], saved)
      qc.invalidateQueries({ queryKey: ['public-info'] })
      message.success('Sozlamalar saqlandi')
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  if (!data) return <Skeleton active />
  const bookingUrl = `${window.location.origin}/booking`

  return (
    <>
      <PageHead title="Sozlamalar" />
      <Form form={form} layout="vertical" onFinish={submit} style={{ maxWidth: 900 }}>
        <Card size="small" title="Korxona ma'lumotlari" style={{ marginBottom: 16 }}>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="company_name" label="Nomi" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="company_phone" label="Telefon">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="company_address" label="Manzil">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card size="small" title="Ish vaqti va onlayn yozilish" style={{ marginBottom: 16 }}>
          <Row gutter={12}>
            <Col xs={12} md={6}>
              <Form.Item name="work_start" label="Ish boshlanishi" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="work_end" label="Ish tugashi" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="slot_minutes" label="Navbat oralig'i (daq)">
                <InputNumber min={15} max={240} step={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="posts_count" label="Postlar soni" tooltip="Bir vaqtda nechta mashina qabul qilinadi (ko'targichlar soni)">
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Text type="secondary">Mijozlar uchun onlayn yozilish havolasi: </Typography.Text>
          <Typography.Text copyable={{ text: bookingUrl, icon: <CopyOutlined /> }} code>
            {bookingUrl}
          </Typography.Text>
        </Card>

        <Card size="small" title="SMS shablonlari" style={{ marginBottom: 16 }}>
          {TEMPLATES.map((t) => (
            <div key={t.key} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <b>{t.title}</b>
                <Form.Item name={t.toggle} valuePropName="checked" noStyle>
                  <Switch checkedChildren="Yoqilgan" unCheckedChildren="O'chirilgan" />
                </Form.Item>
              </div>
              <Form.Item name={t.key} style={{ marginBottom: 4 }}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span className="muted">O'zgaruvchilar: {t.vars}</span>
                <TemplateHint form={form} name={t.key} />
              </div>
            </div>
          ))}
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Eskiz.uz orqali yuborishda har bir SMS matni Eskiz tomonidan oldindan tasdiqlanishi (moderatsiya) kerak.
            Shablonni o'zgartirsangiz, yangi matnni Eskiz kabinetida ham tasdiqlatib oling.
          </Typography.Paragraph>
        </Card>

        <Button type="primary" htmlType="submit" loading={saving} size="large">
          Saqlash
        </Button>
      </Form>
    </>
  )
}
