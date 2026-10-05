import { useQueryClient } from '@tanstack/react-query'
import { App, Col, Divider, Form, Input, InputNumber, Modal, Row, Switch } from 'antd'
import { useEffect, useState } from 'react'
import { errorText, patch, post } from '../api'

const PHONE_RULES = [
  { required: true, message: 'Telefon raqamini kiriting' },
  {
    validator: (_, v) => {
      const digits = String(v || '').replace(/\D/g, '')
      return !v || digits.length === 9 || digits.length === 12
        ? Promise.resolve()
        : Promise.reject(new Error('Masalan: 90 123 45 67'))
    },
  },
]

function VehicleFields({ required = true }) {
  return (
    <Row gutter={12}>
      <Col xs={24} sm={12}>
        <Form.Item
          name="plate_number"
          label="Davlat raqami"
          rules={required ? [{ required: true, message: 'Davlat raqamini kiriting' }] : []}
          normalize={(v) => v?.toUpperCase()}
        >
          <Input placeholder="01 A 123 BC" maxLength={14} />
        </Form.Item>
      </Col>
      <Col xs={12} sm={6}>
        <Form.Item name="brand" label="Marka">
          <Input placeholder="Chevrolet" />
        </Form.Item>
      </Col>
      <Col xs={12} sm={6}>
        <Form.Item name="model" label="Model">
          <Input placeholder="Cobalt" />
        </Form.Item>
      </Col>
      <Col xs={8}>
        <Form.Item name="year" label="Yili">
          <InputNumber min={1950} max={2100} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={8}>
        <Form.Item name="color" label="Rangi">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={8}>
        <Form.Item name="mileage" label="Probeg (km)">
          <InputNumber min={0} step={1000} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24}>
        <Form.Item name="vin" label="VIN (kuzov raqami)">
          <Input maxLength={30} />
        </Form.Item>
      </Col>
    </Row>
  )
}

/**
 * Mijoz qo'shish/tahrirlash. Yangi mijozda birinchi avtomobilni ham shu yerda qo'shish mumkin.
 * onSaved(customer, vehicle?)
 */
export function CustomerModal({ open, onClose, customer, onSaved, withVehicle = true }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()
  const qc = useQueryClient()
  const isNew = !customer

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (customer) form.setFieldsValue({ ...customer, phone: customer.phone?.replace(/^998/, '') })
    }
  }, [open, customer, form])

  const submit = async (values) => {
    setSaving(true)
    const { plate_number, brand, model, year, color, mileage, vin, ...c } = values
    try {
      const saved = isNew ? await post('/customers', c) : await patch(`/customers/${customer.id}`, c)
      let vehicle = null
      if (isNew && withVehicle && plate_number) {
        vehicle = await post('/vehicles', { customer_id: saved.id, plate_number, brand, model, year, color, mileage, vin })
      }
      qc.invalidateQueries({ queryKey: ['customers'] })
      message.success(isNew ? "Mijoz qo'shildi" : 'Saqlandi')
      onSaved?.(saved, vehicle)
      onClose()
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isNew ? 'Yangi mijoz' : 'Mijozni tahrirlash'}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText="Saqlash"
      confirmLoading={saving}
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ sms_enabled: true }}>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="full_name" label="F.I.Sh." rules={[{ required: true, min: 2, message: 'Ismni kiriting' }]}>
              <Input autoFocus />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="phone" label="Telefon" rules={PHONE_RULES}>
              <Input prefix="+998" placeholder="90 123 45 67" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="phone2" label="Qo'shimcha telefon">
              <Input placeholder="ixtiyoriy" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="sms_enabled" label="SMS xabarnomalar" valuePropName="checked">
              <Switch checkedChildren="Ha" unCheckedChildren="Yo'q" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="notes" label="Izoh">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>
        {isNew && withVehicle && (
          <>
            <Divider titlePlacement="start" plain style={{ marginTop: 0 }}>
              Avtomobil (ixtiyoriy)
            </Divider>
            <VehicleFields required={false} />
          </>
        )}
      </Form>
    </Modal>
  )
}

export function VehicleModal({ open, onClose, vehicle, customerId, onSaved }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (vehicle) form.setFieldsValue(vehicle)
    }
  }, [open, vehicle, form])

  const submit = async (values) => {
    setSaving(true)
    try {
      const saved = vehicle
        ? await patch(`/vehicles/${vehicle.id}`, values)
        : await post('/vehicles', { ...values, customer_id: customerId })
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customer'] })
      message.success('Saqlandi')
      onSaved?.(saved)
      onClose()
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={vehicle ? 'Avtomobilni tahrirlash' : "Avtomobil qo'shish"}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText="Saqlash"
      confirmLoading={saving}
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <VehicleFields />
      </Form>
    </Modal>
  )
}
