import { PlusOutlined, UserAddOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { errorText, get, post } from '../api'
import { CustomerSelect, PageHead, serviceOptions, useMechanics, useServices } from '../components/common'
import { CustomerModal, VehicleModal } from '../components/CustomerForms'
import { carName, fmtPlate } from '../utils'

export default function OrderNew() {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [customer, setCustomer] = useState(null)
  const [customerModal, setCustomerModal] = useState(false)
  const [vehicleModal, setVehicleModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const { data: services = [] } = useServices()
  const { data: mechanics = [] } = useMechanics()

  // Mijoz sahifasidan kelganda: ?customer=ID&vehicle=ID
  const presetCustomer = params.get('customer')
  const { data: preset } = useQuery({
    queryKey: ['customer', Number(presetCustomer)],
    queryFn: () => get(`/customers/${presetCustomer}`),
    enabled: Boolean(presetCustomer),
  })
  useEffect(() => {
    if (preset) {
      setCustomer(preset)
      const vehicleId = Number(params.get('vehicle')) || (preset.vehicles.length === 1 ? preset.vehicles[0].id : undefined)
      form.setFieldsValue({ customer_id: preset.id, vehicle_id: vehicleId })
    }
  }, [preset, params, form])

  const vehicles = customer?.vehicles || []
  const vehicleId = Form.useWatch('vehicle_id', form)
  useEffect(() => {
    const v = vehicles.find((x) => x.id === vehicleId)
    if (v?.mileage && !form.getFieldValue('mileage')) form.setFieldValue('mileage', v.mileage)
  }, [vehicleId]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickCustomer = (c, vehicle) => {
    const full = vehicle ? { ...c, vehicles: [...(c.vehicles || []), vehicle] } : c
    setCustomer(full)
    form.setFieldsValue({
      customer_id: c?.id,
      vehicle_id: vehicle?.id || (full?.vehicles?.length === 1 ? full.vehicles[0].id : undefined),
      mileage: vehicle?.mileage || (full?.vehicles?.length === 1 ? full.vehicles[0].mileage : undefined),
    })
  }

  const submit = async (values) => {
    setSaving(true)
    try {
      const order = await post('/orders', {
        customer_id: values.customer_id,
        vehicle_id: values.vehicle_id,
        mechanic_id: values.mechanic_id,
        mileage: values.mileage,
        complaint: values.complaint,
        services: (values.services || []).map((id) => ({ service_id: id, mechanic_id: values.mechanic_id })),
      })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      message.success(`Buyurtma №${order.number} ochildi`)
      navigate(`/orders/${order.id}`, { replace: true })
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHead title="Yangi buyurtma" />
      <Card style={{ maxWidth: 900 }}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item label="Mijoz" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="customer_id" noStyle rules={[{ required: true, message: 'Mijozni tanlang' }]}>
                    <CustomerSelect
                      initialCustomer={customer}
                      onCustomer={(c) => pickCustomer(c)}
                      style={{ width: '100%' }}
                      autoFocus
                    />
                  </Form.Item>
                  <Button icon={<UserAddOutlined />} onClick={() => setCustomerModal(true)}>
                    Yangi
                  </Button>
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item label="Avtomobil" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="vehicle_id" noStyle rules={[{ required: true, message: 'Avtomobilni tanlang' }]}>
                    <Select
                      placeholder={customer ? 'Avtomobilni tanlang' : 'Avval mijozni tanlang'}
                      disabled={!customer}
                      options={vehicles.map((v) => ({ value: v.id, label: `${fmtPlate(v.plate_number)} — ${carName(v)}` }))}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Button icon={<PlusOutlined />} disabled={!customer} onClick={() => setVehicleModal(true)} />
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="mechanic_id" label="Usta">
                <Select allowClear placeholder="Tanlang" options={mechanics.map((m) => ({ value: m.id, label: m.full_name }))} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="mileage" label="Probeg (km)">
                <InputNumber min={0} step={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="services" label="Xizmatlar">
                <Select
                  mode="multiple"
                  placeholder="Moy almashtirish, diagnostika..."
                  options={serviceOptions(services)}
                  showSearch={{ optionFilterProp: 'name' }}
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="complaint" label="Mijoz shikoyati / topshiriq">
                <Input.TextArea rows={3} placeholder="Masalan: tormoz bosganda g'ijirlaydi, moy almashtirish kerak" />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving} size="large">
              Buyurtma ochish
            </Button>
            <Button size="large" onClick={() => navigate(-1)}>
              Bekor qilish
            </Button>
          </Space>
          <div className="muted" style={{ marginTop: 12 }}>
            Ehtiyot qismlar va to'lovlar buyurtma ochilgandan keyin qo'shiladi.
          </div>
        </Form>
      </Card>
      <CustomerModal open={customerModal} onClose={() => setCustomerModal(false)} onSaved={(c, v) => pickCustomer(c, v)} />
      <VehicleModal
        open={vehicleModal}
        onClose={() => setVehicleModal(false)}
        customerId={customer?.id}
        onSaved={(v) => pickCustomer(customer, v)}
      />
    </>
  )
}
