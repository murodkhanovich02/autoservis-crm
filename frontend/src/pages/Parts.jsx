import { DeleteOutlined, EditOutlined, ImportOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { del, errorText, get, patch, post } from '../api'
import { useAuth } from '../auth'
import { PageHead, StatusTag } from '../components/common'
import { fmtDateTime, fmtNum, money, moneyInputProps, MOVEMENT_KINDS } from '../utils'

const UNITS = ['dona', 'litr', 'komplekt', 'kg', 'metr', 'juft']

function useSave(onDone) {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const save = async (fn, ok = 'Saqlandi') => {
    setSaving(true)
    try {
      await fn()
      qc.invalidateQueries({ queryKey: ['parts'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      message.success(ok)
      onDone()
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }
  return { save, saving }
}

function PartModal({ open, onClose, part }) {
  const [form] = Form.useForm()
  const { save, saving } = useSave(onClose)
  useEffect(() => {
    if (open) {
      form.resetFields()
      if (part)
        form.setFieldsValue({
          ...part,
          purchase_price: Number(part.purchase_price),
          sale_price: Number(part.sale_price),
          min_quantity: Number(part.min_quantity),
        })
    }
  }, [open, part, form])

  const submit = (v) => save(() => (part ? patch(`/parts/${part.id}`, v) : post('/parts', v)))
  return (
    <Modal
      title={part ? 'Ehtiyot qismni tahrirlash' : 'Yangi ehtiyot qism'}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText="Saqlash"
      confirmLoading={saving}
      width={620}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ unit: 'dona', min_quantity: 0, quantity: 0 }}>
        <Row gutter={12}>
          <Col xs={24} sm={16}>
            <Form.Item name="name" label="Nomi" rules={[{ required: true, min: 2 }]}>
              <Input placeholder="Moy filtri (Cobalt)" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="code" label="Kod / artikul">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="brand" label="Brend">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="unit" label="O'lchov birligi">
              <Select options={UNITS.map((u) => ({ value: u, label: u }))} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="min_quantity" label="Minimal qoldiq" tooltip="Shundan kam qolsa ogohlantiriladi">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="purchase_price" label="Kirim narxi">
              <InputNumber {...moneyInputProps} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="sale_price" label="Sotuv narxi" rules={[{ required: true }]}>
              <InputNumber {...moneyInputProps} />
            </Form.Item>
          </Col>
          {!part && (
            <Col xs={12} sm={8}>
              <Form.Item name="quantity" label="Boshlang'ich qoldiq">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </Modal>
  )
}

function StockInModal({ open, onClose, part }) {
  const [form] = Form.useForm()
  const { save, saving } = useSave(onClose)
  useEffect(() => {
    if (open && part) {
      form.resetFields()
      form.setFieldsValue({ unit_price: Number(part.purchase_price), update_purchase_price: true })
    }
  }, [open, part, form])
  const submit = (v) => save(() => post(`/parts/${part.id}/stock-in`, v), 'Kirim qilindi')
  return (
    <Modal
      title={`Kirim: ${part?.name || ''}`}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText="Kirim qilish"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="quantity" label={`Miqdor (${part?.unit})`} rules={[{ required: true }]}>
              <InputNumber min={0.001} style={{ width: '100%' }} autoFocus />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="unit_price" label="Kirim narxi (1 birlik)">
              <InputNumber {...moneyInputProps} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="supplier" label="Yetkazib beruvchi">
          <Input />
        </Form.Item>
        <Form.Item name="note" label="Izoh">
          <Input />
        </Form.Item>
        <Form.Item name="update_purchase_price" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Kirim narxini yangilash</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  )
}

function AdjustModal({ open, onClose, part }) {
  const [form] = Form.useForm()
  const { save, saving } = useSave(onClose)
  useEffect(() => {
    if (open && part) form.setFieldsValue({ quantity: Number(part.quantity), note: '' })
  }, [open, part, form])
  const submit = (v) => save(() => post(`/parts/${part.id}/adjust`, v), 'Qoldiq tuzatildi')
  return (
    <Modal
      title={`Inventarizatsiya: ${part?.name || ''}`}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText="Saqlash"
      confirmLoading={saving}
      destroyOnHidden
    >
      <p className="muted">
        Tizimdagi qoldiq: {fmtNum(part?.quantity)} {part?.unit}. Omborda sanab chiqilgan haqiqiy miqdorni kiriting.
      </p>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="quantity" label="Haqiqiy qoldiq" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="note" label="Sabab">
          <Input placeholder="Inventarizatsiya" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function StockTab() {
  const [params, setParams] = useSearchParams()
  const { isStaff } = useAuth()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState({ type: null, part: null })
  const lowOnly = params.get('low') === '1'
  const pageSize = 50
  const query = { q: q || undefined, low_stock: lowOnly || undefined, skip: (page - 1) * pageSize, limit: pageSize }
  const { data, isFetching } = useQuery({
    queryKey: ['parts', query],
    queryFn: () => get('/parts', query),
    placeholderData: keepPreviousData,
  })
  const { data: value } = useQuery({ queryKey: ['parts', 'value'], queryFn: () => get('/parts/stock-value'), enabled: isStaff })
  const close = () => setModal({ type: null, part: null })

  const remove = async (p) => {
    try {
      await del(`/parts/${p.id}`)
      qc.invalidateQueries({ queryKey: ['parts'] })
      message.success("O'chirildi")
    } catch (e) {
      message.error(errorText(e))
    }
  }

  return (
    <>
      {isStaff && value && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic title="Pozitsiyalar" value={value.items} />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic title="Ombor qiymati (tannarx)" value={Math.round(value.purchase_value)} groupSeparator=" " suffix="so'm" />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic title="Sotuv narxida" value={Math.round(value.sale_value)} groupSeparator=" " suffix="so'm" />
            </Card>
          </Col>
        </Row>
      )}
      <div className="toolbar">
        <Input.Search
          placeholder="Nomi, kodi yoki brendi"
          allowClear
          onSearch={(v) => {
            setQ(v.trim())
            setPage(1)
          }}
          style={{ width: 300 }}
        />
        <Checkbox
          checked={lowOnly}
          onChange={(e) => {
            setParams(e.target.checked ? { low: '1' } : {}, { replace: true })
            setPage(1)
          }}
          style={{ alignSelf: 'center' }}
        >
          <WarningOutlined style={{ color: '#d97706' }} /> Faqat kam qolganlar
        </Checkbox>
        <div style={{ flex: 1 }} />
        {isStaff && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ type: 'part', part: null })}>
            Yangi ehtiyot qism
          </Button>
        )}
      </div>
      <Table
        rowKey="id"
        size="middle"
        loading={isFetching}
        dataSource={data?.items}
        scroll={{ x: 900 }}
        pagination={{ current: page, pageSize, total: data?.total, onChange: setPage, hideOnSinglePage: true }}
        columns={[
          { title: 'Kod', dataIndex: 'code', width: 120, render: (v) => v || '—' },
          {
            title: 'Nomi',
            dataIndex: 'name',
            render: (v, p) => (
              <>
                {v}
                {p.brand && <div className="muted">{p.brand}</div>}
              </>
            ),
          },
          {
            title: 'Qoldiq',
            dataIndex: 'quantity',
            align: 'right',
            render: (v, p) => (
              <Tag color={p.is_low ? (Number(v) <= 0 ? 'red' : 'orange') : 'green'} style={{ marginInlineEnd: 0 }}>
                {fmtNum(v)} {p.unit}
              </Tag>
            ),
          },
          { title: 'Min', dataIndex: 'min_quantity', align: 'right', render: fmtNum },
          isStaff && { title: 'Kirim narxi', dataIndex: 'purchase_price', align: 'right', render: (v) => <span className="num">{money(v)}</span> },
          { title: 'Sotuv narxi', dataIndex: 'sale_price', align: 'right', render: (v) => <b className="num">{money(v)}</b> },
          isStaff && {
            width: 170,
            render: (_, p) => (
              <Space size={4}>
                <Tooltip title="Kirim">
                  <Button size="small" type="primary" ghost icon={<ImportOutlined />} onClick={() => setModal({ type: 'in', part: p })} />
                </Tooltip>
                <Tooltip title="Inventarizatsiya">
                  <Button size="small" onClick={() => setModal({ type: 'adjust', part: p })}>
                    ±
                  </Button>
                </Tooltip>
                <Tooltip title="Harakatlar tarixi">
                  <Button size="small" onClick={() => navigate(`/parts?tab=moves&part=${p.id}`)}>
                    Tarix
                  </Button>
                </Tooltip>
                <Button size="small" icon={<EditOutlined />} onClick={() => setModal({ type: 'part', part: p })} />
                <Popconfirm title="O'chirilsinmi?" onConfirm={() => remove(p)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ].filter(Boolean)}
      />
      <PartModal open={modal.type === 'part'} part={modal.part} onClose={close} />
      <StockInModal open={modal.type === 'in'} part={modal.part} onClose={close} />
      <AdjustModal open={modal.type === 'adjust'} part={modal.part} onClose={close} />
    </>
  )
}

function MovementsTab({ partId }) {
  const navigate = useNavigate()
  const [kind, setKind] = useState()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const query = { part_id: partId, kind, skip: (page - 1) * pageSize, limit: pageSize }
  const { data, isFetching } = useQuery({
    queryKey: ['movements', query],
    queryFn: () => get('/stock-movements', query),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <div className="toolbar">
        <Select
          placeholder="Turi"
          allowClear
          value={kind}
          onChange={(v) => {
            setKind(v)
            setPage(1)
          }}
          options={Object.entries(MOVEMENT_KINDS).map(([value, k]) => ({ value, label: k.label }))}
          style={{ width: 200 }}
        />
        {partId && <Button onClick={() => navigate('/parts?tab=moves')}>Barcha ehtiyot qismlar</Button>}
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
          { title: 'Ehtiyot qism', render: (_, m) => m.part.name },
          { title: 'Turi', dataIndex: 'kind', render: (k) => <StatusTag status={k} map={MOVEMENT_KINDS} /> },
          {
            title: 'Miqdor',
            dataIndex: 'quantity',
            align: 'right',
            render: (v, m) => (
              <b style={{ color: v > 0 ? '#15803d' : '#dc2626' }}>
                {v > 0 ? '+' : ''}
                {fmtNum(v)} {m.part.unit}
              </b>
            ),
          },
          { title: 'Narx', dataIndex: 'unit_price', align: 'right', render: (v) => <span className="num">{money(v)}</span> },
          {
            title: 'Izoh',
            render: (_, m) => (
              <>
                {m.order_id ? <a onClick={() => navigate(`/orders/${m.order_id}`)}>{m.note}</a> : m.note}
                {m.supplier && <div className="muted">{m.supplier}</div>}
              </>
            ),
          },
          { title: 'Xodim', render: (_, m) => m.user?.full_name || '—' },
        ]}
      />
    </>
  )
}

export default function Parts() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'stock'
  const partId = params.get('part') ? Number(params.get('part')) : undefined
  return (
    <>
      <PageHead title="Ombor (ehtiyot qismlar)" />
      <Card size="small">
        <Tabs
          activeKey={tab}
          onChange={(k) => setParams(k === 'stock' ? {} : { tab: k }, { replace: true })}
          items={[
            { key: 'stock', label: 'Qoldiqlar', children: <StockTab /> },
            { key: 'moves', label: 'Kirim-chiqim tarixi', children: <MovementsTab partId={partId} /> },
          ]}
        />
      </Card>
    </>
  )
}
