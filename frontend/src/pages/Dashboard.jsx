import { CalendarOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Empty, Row, Statistic, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { get } from '../api'
import { PageHead, Plate, StatusTag } from '../components/common'
import { APPT_STATUS, money, moneyShort, OPEN_STATUSES, ORDER_STATUS } from '../utils'

function Stat({ title, value, suffix, color, onClick, prefix }) {
  return (
    <Card size="small" className="stat-card" hoverable={Boolean(onClick)} onClick={onClick}>
      <Statistic
        title={title}
        value={value}
        suffix={suffix}
        prefix={prefix}
        groupSeparator=" "
        styles={{ content: { color, fontSize: 22, fontWeight: 600 } }}
      />
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: () => get('/reports/dashboard'), refetchInterval: 60_000 })
  const { data: daily = [] } = useQuery({
    queryKey: ['reports', 'daily', 'last14'],
    queryFn: () =>
      get('/reports/daily', { date_from: dayjs().subtract(13, 'day').format('YYYY-MM-DD'), date_to: today }),
  })
  const { data: appts = [], isLoading: apptsLoading } = useQuery({
    queryKey: ['appointments', today],
    queryFn: () => get('/appointments', { day: today }),
  })

  const open = data?.open_orders || {}

  return (
    <>
      <PageHead
        title="Bosh sahifa"
        extra={
          <>
            <Button icon={<CalendarOutlined />} onClick={() => navigate('/appointments?new=1')}>
              Navbatga yozish
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/orders/new')}>
              Yangi buyurtma
            </Button>
          </>
        }
      />
      <Row gutter={[12, 12]}>
        <Col xs={12} md={8} xl={4}>
          <Stat title="Bugungi tushum" value={Math.round(data?.revenue_today || 0)} suffix="so'm" color="#15803d" />
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Stat title="Oylik tushum" value={Math.round(data?.revenue_month || 0)} suffix="so'm" />
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Stat title="Bugungi buyurtmalar" value={data?.orders_today || 0} />
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Stat title="Bugungi navbatlar" value={data?.appointments_today || 0} onClick={() => navigate('/appointments')} />
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Stat
            title="Mijozlar qarzi"
            value={Math.round(data?.total_debt || 0)}
            suffix="so'm"
            color={data?.total_debt ? '#dc2626' : undefined}
            onClick={() => navigate('/orders?debt=1')}
          />
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Stat
            title="Kam qolgan zapchastlar"
            value={data?.low_stock || 0}
            prefix={data?.low_stock ? <WarningOutlined /> : null}
            color={data?.low_stock ? '#d97706' : undefined}
            onClick={() => navigate('/parts?low=1')}
          />
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} xl={14}>
          <Card title="Ustaxonadagi mashinalar" size="small">
            <Row gutter={[8, 8]}>
              {OPEN_STATUSES.map((s) => (
                <Col xs={12} sm={6} key={s}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => navigate(`/orders?status=${s}`)}
                    styles={{ body: { textAlign: 'center', padding: 12 } }}
                  >
                    <div style={{ fontSize: 28, fontWeight: 700 }}>{open[s] || 0}</div>
                    <StatusTag status={s} map={ORDER_STATUS} />
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
          <Card title="So'nggi 14 kun tushumi" size="small" style={{ marginTop: 12 }}>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={daily} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('DD.MM')} fontSize={12} />
                  <YAxis tickFormatter={moneyShort} fontSize={12} width={60} />
                  <Tooltip formatter={(v) => money(v)} labelFormatter={(d) => dayjs(d).format('DD.MM.YYYY')} />
                  <Bar dataKey="cash_in" name="Tushum" fill="#1668dc" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card
            title="Bugungi navbat"
            size="small"
            extra={<Button type="link" onClick={() => navigate('/appointments')}>Hammasi</Button>}
          >
            <Table
              size="small"
              rowKey="id"
              loading={apptsLoading}
              dataSource={appts}
              pagination={false}
              locale={{ emptyText: <Empty description="Bugun navbat yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              columns={[
                { title: 'Vaqt', dataIndex: 'scheduled_at', width: 60, render: (v) => <b>{dayjs(v).format('HH:mm')}</b> },
                {
                  title: 'Mijoz',
                  render: (_, r) => (
                    <div>
                      {r.customer_name} {r.source === 'online' && <Tag color="purple">onlayn</Tag>}
                      <div className="muted">{r.service?.name || r.car_info}</div>
                    </div>
                  ),
                },
                { title: 'Raqam', dataIndex: 'plate_number', render: (v) => <Plate value={v} /> },
                { title: 'Holat', dataIndex: 'status', render: (s) => <StatusTag status={s} map={APPT_STATUS} /> },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
