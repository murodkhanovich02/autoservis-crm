import { FileExcelOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Card, Col, DatePicker, Row, Statistic, Table, Tabs } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { download, errorText, get } from '../api'
import { PageHead } from '../components/common'
import { fmtNum, money, moneyShort } from '../utils'

const PIE_COLORS = ['#1668dc', '#15803d', '#d97706', '#7c3aed', '#0891b2']

const PRESETS = [
  { label: 'Bugun', value: [dayjs(), dayjs()] },
  { label: 'Kecha', value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
  { label: 'Shu hafta', value: [dayjs().startOf('week'), dayjs()] },
  { label: 'Shu oy', value: [dayjs().startOf('month'), dayjs()] },
  {
    label: "O'tgan oy",
    value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
  { label: 'Shu yil', value: [dayjs().startOf('year'), dayjs()] },
]

function Kpi({ title, value, color, hint }) {
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Statistic
        title={title}
        value={Math.round(value || 0)}
        groupSeparator=" "
        suffix="so'm"
        styles={{ content: { color, fontSize: 20, fontWeight: 600 } }}
      />
      {hint && <div className="muted">{hint}</div>}
    </Card>
  )
}

const moneyCol = (title, dataIndex, extra = {}) => ({
  title,
  dataIndex,
  align: 'right',
  render: (v) => <span className="num">{money(v)}</span>,
  sorter: (a, b) => a[dataIndex] - b[dataIndex],
  ...extra,
})

export default function Reports() {
  const { message } = App.useApp()
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs()])
  const [exporting, setExporting] = useState(false)
  const params = { date_from: range[0].format('YYYY-MM-DD'), date_to: range[1].format('YYYY-MM-DD') }
  const q = (key) => ({ queryKey: ['reports', key, params], queryFn: () => get(`/reports/${key}`, params) })
  const { data: s } = useQuery(q('summary'))
  const { data: daily = [] } = useQuery(q('daily'))
  const { data: services = [], isFetching: l1 } = useQuery(q('services'))
  const { data: mechanics = [], isFetching: l2 } = useQuery(q('mechanics'))
  const { data: parts = [], isFetching: l3 } = useQuery(q('parts'))

  const exportXlsx = async () => {
    setExporting(true)
    try {
      await download('/reports/export', params, 'hisobot.xlsx')
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHead
        title="Hisobotlar"
        extra={
          <>
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => v && setRange(v)}
              presets={PRESETS}
              format="DD.MM.YYYY"
              allowClear={false}
            />
            <Button icon={<FileExcelOutlined />} loading={exporting} onClick={exportXlsx} style={{ color: '#15803d' }}>
              Excel
            </Button>
          </>
        }
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <Kpi title="Tushum (yopilgan buyurtmalar)" value={s?.revenue} hint={`${s?.orders_closed || 0} ta buyurtma`} />
        </Col>
        <Col xs={12} lg={6}>
          <Kpi title="Kassaga tushgan pul" value={s?.cash_in} color="#1668dc" />
        </Col>
        <Col xs={12} lg={6}>
          <Kpi title="O'rtacha chek" value={s?.avg_check} />
        </Col>
        <Col xs={12} lg={6}>
          <Kpi
            title="Sof foyda"
            value={s?.net_profit}
            color={s?.net_profit < 0 ? '#dc2626' : '#15803d'}
            hint="Tushum − zapchast tannarxi − ish haqi − xarajatlar"
          />
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} xl={16}>
          <Card size="small" title="Kunlik dinamika">
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <ComposedChart data={daily} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('DD.MM')} fontSize={12} />
                  <YAxis tickFormatter={moneyShort} fontSize={12} width={60} />
                  <Tooltip formatter={(v, n) => (n === 'Buyurtmalar' ? v : money(v))} labelFormatter={(d) => dayjs(d).format('DD.MM.YYYY')} />
                  <Legend />
                  <Bar dataKey="cash_in" name="Kassaga tushgan" fill="#1668dc" radius={[4, 4, 0, 0]} />
                  <Line dataKey="revenue" name="Yopilgan buyurtmalar summasi" stroke="#15803d" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card size="small" title="Moliyaviy natija" style={{ height: '100%' }}>
            {[
              ['Xizmatlar', s?.services_revenue],
              ['Ehtiyot qismlar sotuvi', s?.parts_revenue],
              ['Chegirmalar', -(s?.discount || 0)],
              ['Tushum', s?.revenue, true],
              ['Zapchastlar tannarxi', -(s?.parts_cost || 0)],
              ['Yalpi foyda', s?.gross_profit, true],
              ['Ustalar ish haqi', -(s?.mechanic_commissions || 0)],
              ['Xarajatlar', -(s?.expenses_total || 0)],
              ['Sof foyda', s?.net_profit, true],
            ].map(([label, v, bold]) => (
              <div key={label} className={bold ? 'totals-row big' : 'totals-row'} style={bold ? { fontSize: 14 } : undefined}>
                <span>{label}</span>
                <span className="num" style={{ color: v < 0 ? '#dc2626' : undefined }}>
                  {money(v)}
                </span>
              </div>
            ))}
            <div className="muted" style={{ marginTop: 8 }}>
              Yangi mijozlar: {s?.new_customers || 0}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} md={12} xl={8}>
          <Card size="small" title="To'lov usullari" style={{ height: '100%' }}>
            {s?.payments_by_method?.length ? (
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={s.payments_by_method} dataKey="amount" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {s.payments_by_method.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="muted">Ma'lumot yo'q</div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12} xl={16}>
          <Card size="small" title="Xarajatlar" style={{ height: '100%' }}>
            <Table
              size="small"
              rowKey="category"
              pagination={false}
              dataSource={s?.expenses_by_category || []}
              columns={[{ title: 'Kategoriya', dataIndex: 'category' }, moneyCol('Summa', 'amount')]}
              summary={(rows) =>
                rows.length > 0 && (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <b>Jami</b>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <b>{money(s?.expenses_total)}</b>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )
              }
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 12 }}>
        <Tabs
          items={[
            {
              key: 'services',
              label: 'Xizmatlar',
              children: (
                <Table
                  size="small"
                  rowKey="name"
                  loading={l1}
                  dataSource={services}
                  pagination={{ pageSize: 20, hideOnSinglePage: true }}
                  columns={[
                    { title: 'Xizmat', dataIndex: 'name' },
                    { title: 'Soni', dataIndex: 'count', align: 'center', render: fmtNum, sorter: (a, b) => a.count - b.count },
                    moneyCol('Summa', 'revenue', { defaultSortOrder: 'descend' }),
                  ]}
                />
              ),
            },
            {
              key: 'mechanics',
              label: 'Ustalar',
              children: (
                <Table
                  size="small"
                  rowKey="id"
                  loading={l2}
                  dataSource={mechanics}
                  pagination={false}
                  columns={[
                    { title: 'Usta', dataIndex: 'name' },
                    { title: 'Buyurtmalar', dataIndex: 'orders', align: 'center' },
                    moneyCol('Bajargan ishlar', 'revenue'),
                    { title: 'Foiz', dataIndex: 'percent', align: 'center', render: (v) => `${v}%` },
                    moneyCol('Ish haqi', 'commission'),
                  ]}
                />
              ),
            },
            {
              key: 'parts',
              label: 'Ehtiyot qismlar',
              children: (
                <Table
                  size="small"
                  rowKey="name"
                  loading={l3}
                  dataSource={parts}
                  pagination={{ pageSize: 20, hideOnSinglePage: true }}
                  scroll={{ x: 600 }}
                  columns={[
                    { title: 'Nomi', dataIndex: 'name' },
                    { title: 'Miqdor', dataIndex: 'quantity', align: 'center', render: fmtNum },
                    moneyCol('Sotuv', 'revenue'),
                    moneyCol('Tannarx', 'cost'),
                    moneyCol('Foyda', 'profit'),
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  )
}
