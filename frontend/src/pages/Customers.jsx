import { PlusOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Card, Input, Space, Table } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '../api'
import { useAuth } from '../auth'
import { PageHead, Plate } from '../components/common'
import { CustomerModal } from '../components/CustomerForms'
import { carName, fmtDate, fmtPhone } from '../utils'

export default function Customers() {
  const navigate = useNavigate()
  const { isStaff } = useAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const pageSize = 20
  const params = { q: q || undefined, skip: (page - 1) * pageSize, limit: pageSize }
  const { data, isFetching } = useQuery({
    queryKey: ['customers', params],
    queryFn: () => get('/customers', params),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHead
        title="Mijozlar"
        extra={
          isStaff && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>
              Yangi mijoz
            </Button>
          )
        }
      />
      <Card size="small">
        <div className="toolbar">
          <Input.Search
            placeholder="Ism, telefon yoki davlat raqami"
            allowClear
            onSearch={(v) => {
              setQ(v.trim())
              setPage(1)
            }}
            style={{ width: 320, maxWidth: '100%' }}
          />
        </div>
        <Table
          rowKey="id"
          loading={isFetching}
          dataSource={data?.items}
          rowClassName="clickable-row"
          onRow={(r) => ({ onClick: () => navigate(`/customers/${r.id}`) })}
          scroll={{ x: 700 }}
          pagination={{ current: page, pageSize, total: data?.total, onChange: setPage, showTotal: (t) => `Jami: ${t}` }}
          columns={[
            { title: 'F.I.Sh.', dataIndex: 'full_name', render: (v) => <b>{v}</b> },
            { title: 'Telefon', dataIndex: 'phone', render: fmtPhone },
            {
              title: 'Avtomobillar',
              dataIndex: 'vehicles',
              render: (vs) => (
                <Space wrap size={4}>
                  {vs.map((v) => (
                    <span key={v.id}>
                      <Plate value={v.plate_number} /> <span className="muted">{carName(v)}</span>
                    </span>
                  ))}
                </Space>
              ),
            },
            { title: "Qo'shilgan", dataIndex: 'created_at', render: fmtDate, width: 120 },
          ]}
        />
      </Card>
      <CustomerModal open={modal} onClose={() => setModal(false)} onSaved={(c) => navigate(`/customers/${c.id}`)} />
    </>
  )
}
