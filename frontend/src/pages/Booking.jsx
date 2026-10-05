import { EnvironmentOutlined, PhoneOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, DatePicker, Empty, Form, Input, Radio, Result, Select, Spin, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { errorText, get, post } from '../api'
import { money } from '../utils'

export default function Booking() {
  const [form] = Form.useForm()
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const day = Form.useWatch('day', form)

  const { data: info } = useQuery({ queryKey: ['public-info'], queryFn: () => get('/public/info') })
  const { data: services = [] } = useQuery({ queryKey: ['public-services'], queryFn: () => get('/public/services') })
  const { data: slots, isFetching: slotsLoading } = useQuery({
    queryKey: ['public-slots', day?.format('YYYY-MM-DD')],
    queryFn: () => get('/public/slots', { day: day.format('YYYY-MM-DD') }),
    enabled: Boolean(day),
  })

  const groups = {}
  for (const s of services) (groups[s.category || 'Boshqa'] ||= []).push(s)
  const serviceOptions = Object.entries(groups).map(([label, items]) => ({
    label,
    options: items.map((s) => ({ value: s.id, label: `${s.name} — ${money(s.price)} dan`, name: s.name })),
  }))

  const submit = async (v) => {
    setSending(true)
    setError(null)
    try {
      const r = await post('/public/appointments', {
        customer_name: v.customer_name,
        phone: v.phone,
        plate_number: v.plate_number,
        car_info: v.car_info,
        service_id: v.service_id,
        note: v.note,
        scheduled_at: `${v.day.format('YYYY-MM-DD')}T${v.time}:00`,
      })
      setDone(r)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0f1b2d 0, #0f1b2d 220px, #f3f5f8 220px)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ color: '#fff', textAlign: 'center', marginBottom: 20 }}>
          <img src="/favicon.svg" width={48} height={48} alt="" />
          <h1 style={{ margin: '8px 0 4px', fontSize: 26 }}>{info?.company_name || 'AutoServis'}</h1>
          <div style={{ opacity: 0.8 }}>Onlayn navbatga yozilish</div>
          {info && (
            <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
              <EnvironmentOutlined /> {info.company_address} &nbsp; · &nbsp;
              <a href={`tel:${info.company_phone.replace(/\s/g, '')}`} style={{ color: '#fff' }}>
                <PhoneOutlined /> {info.company_phone}
              </a>
              <br />
              Ish vaqti: {info.work_start} – {info.work_end}
            </div>
          )}
        </div>

        <Card>
          {done ? (
            <Result
              status="success"
              title="Arizangiz qabul qilindi!"
              subTitle={
                <>
                  {dayjs(done.scheduled_at).format('DD.MM.YYYY, HH:mm')} ga yozildingiz.
                  <br />
                  Administrator tasdiqlagach, sizga SMS keladi.
                </>
              }
              extra={
                <Button
                  onClick={() => {
                    form.resetFields()
                    setDone(null)
                  }}
                >
                  Yana yozilish
                </Button>
              }
            />
          ) : (
            <Form form={form} layout="vertical" onFinish={submit} size="large" requiredMark={false}>
              <Form.Item name="service_id" label="Xizmat">
                <Select
                  placeholder="Tanlang (ixtiyoriy)"
                  allowClear
                  showSearch={{ optionFilterProp: 'name' }}
                  options={serviceOptions}
                />
              </Form.Item>
              <Form.Item name="day" label="Sana" rules={[{ required: true, message: 'Sanani tanlang' }]}>
                <DatePicker
                  format="DD.MM.YYYY, dddd"
                  style={{ width: '100%' }}
                  inputReadOnly
                  disabledDate={(d) => d.isBefore(dayjs(), 'day') || d.isAfter(dayjs().add(30, 'day'))}
                  onChange={() => form.setFieldValue('time', undefined)}
                />
              </Form.Item>
              {day && (
                <Form.Item name="time" label="Vaqt" rules={[{ required: true, message: 'Vaqtni tanlang' }]}>
                  {slotsLoading ? (
                    <Spin />
                  ) : slots?.length ? (
                    <Radio.Group
                      optionType="button"
                      buttonStyle="solid"
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
                      options={slots.map((s) => ({ value: s.time, label: s.time, disabled: s.free <= 0 }))}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bu kunda bo'sh vaqt yo'q" />
                  )}
                </Form.Item>
              )}
              <Form.Item name="customer_name" label="Ismingiz" rules={[{ required: true, min: 2, message: 'Ismingizni kiriting' }]}>
                <Input autoComplete="name" />
              </Form.Item>
              <Form.Item
                name="phone"
                label="Telefon raqamingiz"
                rules={[
                  { required: true, message: 'Telefon raqamini kiriting' },
                  { pattern: /^[\d\s()-]{9,}$/, message: 'Masalan: 90 123 45 67' },
                ]}
              >
                <Input prefix="+998" placeholder="90 123 45 67" inputMode="tel" autoComplete="tel-national" />
              </Form.Item>
              <Form.Item name="car_info" label="Avtomobil">
                <Input placeholder="Masalan: Chevrolet Cobalt" />
              </Form.Item>
              <Form.Item name="plate_number" label="Davlat raqami" normalize={(v) => v?.toUpperCase()}>
                <Input placeholder="01 A 123 BC" />
              </Form.Item>
              <Form.Item name="note" label="Izoh">
                <Input.TextArea rows={2} placeholder="Muammo haqida qisqacha (ixtiyoriy)" />
              </Form.Item>
              {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
              <Button type="primary" htmlType="submit" block loading={sending}>
                Navbatga yozilish
              </Button>
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12, textAlign: 'center' }}>
                Telefon raqamingiz faqat navbat haqida xabar berish uchun ishlatiladi.
              </Typography.Paragraph>
            </Form>
          )}
        </Card>
      </div>
    </div>
  )
}
