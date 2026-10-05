import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Descriptions, Popconfirm, Result, Row, Skeleton, Space, Statistic, Table, Tag } from 'antd'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { del, errorText, get } from '../api'
import { useAuth } from '../auth'
import { PageHead, Plate, StatusTag } from '../components/common'
import { CustomerModal, VehicleModal } from '../components/CustomerForms'
import { fmtDate, fmtDateTime, fmtNum, fmtPhone, money, ORDER_STATUS } from '../utils'

export default function CustomerDetail() {
  const { id } = useParams()
  const customerId = Number(id)
  const navigate = useNavigate()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { isStaff, isAdmin } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const [vehicleModal, setVehicleModal] = useState({ open: false, vehicle: null })

  const { data: c, isLoading, error } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => get(`/customers/${customerId}`),
  })
  const { data: orders = [], isFetching: ordersLoading } = useQuery({
    queryKey: ['orders', 'customer', customerId],
    queryFn: () => get(`/customers/${customerId}/orders`),
  })

  if (isLoading) return <Skeleton active />
  if (error) return <Result status="404" title="Mijoz topilmadi" />

  const refresh = () => qc.invalidateQueries({ queryKey: ['customer', customerId] })

  const removeVehicle = async (v) => {
    try {
      await del(`/vehicles/${v.id}`)
      message.success("O'chirildi")
      refresh()
    } catch (e) {
      message.error(errorText(e))
    }
  }

  const removeCustomer = async () => {
    try {
      await del(`/customers/${customerId}`)
      qc.invalidateQueries({ queryKey: ['customers'] })
      message.success("Mijoz o'chirildi")
      navigate('/customers')
    } catch (e) {
      message.error(errorText(e))
    }
  }

  return (
    <>
      <PageHead
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
            {c.full_name}
            {!c.sms_enabled && <Tag>SMS o'chirilgan</Tag>}
          </Space>
        }
        extra={
          isStaff && (
            <>
              <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                Tahrirlash
              </Button>
              {isAdmin && orders.length === 0 && (
                <Popconfirm title="Mijoz o'chirilsinmi?" onConfirm={removeCustomer}>
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/orders/new?customer=${c.id}`)}>
                Yangi buyurtma
              </Button>
            </>
          )
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card size="small" title="Ma'lumotlar">
            <Descriptions
              column={1}
              size="small"
              items={[
                { label: 'Telefon', children: <a href={`tel:+${c.phone}`}>{fmtPhone(c.phone)}</a> },
                c.phone2 && { label: "Qo'shimcha", children: fmtPhone(c.phone2) },
                { label: "Qo'shilgan", children: fmtDate(c.created_at) },
                { label: 'Oxirgi tashrif', children: fmtDateTime(c.stats.last_visit) },
                c.notes && { label: 'Izoh', children: c.notes },
              ].filter(Boolean)}
            />
          </Card>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card size="small">
                <Statistic title="Buyurtmalar" value={c.stats.orders_count} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic title="Jami to'lagan" value={Math.round(c.stats.total_spent)} groupSeparator=" " suffix="so'm" styles={{ content: { fontSize: 18 } }} />
              </Card>
            </Col>
            {c.stats.debt > 0 && (
              <Col span={24}>
                <Card size="small">
                  <Statistic
                    title="Qarz"
                    value={Math.round(c.stats.debt)}
                    groupSeparator=" "
                    suffix="so'm"
                    styles={{ content: { color: '#dc2626', fontSize: 18 } }}
                  />
                </Card>
              </Col>
            )}
          </Row>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            size="small"
            title="Avtomobillar"
            extra={
              isStaff && (
                <Button size="small" icon={<PlusOutlined />} onClick={() => setVehicleModal({ open: true, vehicle: null })}>
                  Qo'shish
                </Button>
              )
            }
          >
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={c.vehicles}
              scroll={{ x: 560 }}
              columns={[
                { title: 'Raqam', dataIndex: 'plate_number', render: (v) => <Plate value={v} /> },
                { title: 'Marka / model', render: (_, v) => [v.brand, v.model].filter(Boolean).join(' ') || '—' },
                { title: 'Yili', dataIndex: 'year', render: (v) => v || '—' },
                { title: 'Probeg', dataIndex: 'mileage', render: (v) => (v ? `${fmtNum(v)} km` : '—') },
                isStaff && {
                  width: 150,
                  render: (_, v) => (
                    <Space>
                      <Button size="small" onClick={() => navigate(`/orders/new?customer=${c.id}&vehicle=${v.id}`)}>
                        Buyurtma
                      </Button>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={async () => setVehicleModal({ open: true, vehicle: await get(`/vehicles/${v.id}`) })}
                      />
                      {isAdmin && (
                        <Popconfirm title="O'chirilsinmi?" onConfirm={() => removeVehicle(v)}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ].filter(Boolean)}
            />
          </Card>

          <Card size="small" title="Tashriflar tarixi" style={{ marginTop: 16 }}>
            <Table
              rowKey="id"
              size="small"
              loading={ordersLoading}
              dataSource={orders}
              rowClassName="clickable-row"
              onRow={(r) => ({ onClick: () => navigate(`/orders/${r.id}`) })}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              scroll={{ x: 560 }}
              columns={[
                { title: '№', dataIndex: 'number' },
                { title: 'Sana', dataIndex: 'created_at', render: fmtDate },
                { title: 'Avtomobil', render: (_, r) => <Plate value={r.vehicle.plate_number} /> },
                { title: 'Holat', dataIndex: 'status', render: (s) => <StatusTag status={s} map={ORDER_STATUS} /> },
                { title: 'Summa', dataIndex: 'total', align: 'right', render: (v) => <span className="num">{money(v)}</span> },
                {
                  title: 'Qarz',
                  dataIndex: 'debt',
                  align: 'right',
                  render: (v, r) => (v > 0 && r.status !== 'cancelled' ? <span style={{ color: '#dc2626' }}>{money(v)}</span> : '—'),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <CustomerModal open={editOpen} onClose={() => setEditOpen(false)} customer={c} onSaved={refresh} />
      <VehicleModal
        open={vehicleModal.open}
        vehicle={vehicleModal.vehicle}
        customerId={c.id}
        onClose={() => setVehicleModal({ open: false, vehicle: null })}
        onSaved={refresh}
      />
    </>
  )
}
