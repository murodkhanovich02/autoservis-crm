import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, AutoComplete, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Table } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { del, errorText, get, post } from '../api'
import { useAuth } from '../auth'
import { PageHead } from '../components/common'
import { fmtDate, money, moneyInputProps } from '../utils'

function ExpenseModal({ open, onClose }) {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const { data: categories = [] } = useQuery({ queryKey: ['expenses', 'categories'], queryFn: () => get('/expenses/categories') })

  const submit = async (v) => {
    setSaving(true)
    try {
      await post('/expenses', { ...v, spent_on: v.spent_on.format('YYYY-MM-DD') })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      message.success("Xarajat qo'shildi")
      form.resetFields()
      onClose()
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Yangi xarajat" open={open} onCancel={onClose} onOk={form.submit} okText="Saqlash" confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ spent_on: dayjs() }}>
        <Form.Item name="category" label="Kategoriya" rules={[{ required: true, min: 2 }]}>
          <AutoComplete
            options={categories.map((c) => ({ value: c }))}
            showSearch={{ filterOption: (input, o) => o.value.toLowerCase().includes(input.toLowerCase()) }}
            placeholder="Ijara, kommunal, ish haqi..."
          />
        </Form.Item>
        <Form.Item name="amount" label="Summa (so'm)" rules={[{ required: true }]}>
          <InputNumber {...moneyInputProps} min={1} />
        </Form.Item>
        <Form.Item name="spent_on" label="Sana" rules={[{ required: true }]}>
          <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="note" label="Izoh">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function Expenses() {
  const { isAdmin } = useAuth()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs()])
  const [open, setOpen] = useState(false)
  const params = { date_from: range[0].format('YYYY-MM-DD'), date_to: range[1].format('YYYY-MM-DD') }
  const { data = [], isFetching } = useQuery({ queryKey: ['expenses', params], queryFn: () => get('/expenses', params) })
  const total = data.reduce((s, e) => s + Number(e.amount), 0)

  const remove = async (e) => {
    try {
      await del(`/expenses/${e.id}`)
      qc.invalidateQueries({ queryKey: ['expenses'] })
      message.success("O'chirildi")
    } catch (err) {
      message.error(errorText(err))
    }
  }

  return (
    <>
      <PageHead
        title="Xarajatlar"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            Xarajat qo'shish
          </Button>
        }
      />
      <Card size="small">
        <div className="toolbar">
          <DatePicker.RangePicker value={range} onChange={(v) => v && setRange(v)} format="DD.MM.YYYY" allowClear={false} />
          <div style={{ alignSelf: 'center' }}>
            Jami: <b>{money(total)}</b>
          </div>
        </div>
        <Table
          rowKey="id"
          loading={isFetching}
          dataSource={data}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          columns={[
            { title: 'Sana', dataIndex: 'spent_on', render: fmtDate, width: 120 },
            { title: 'Kategoriya', dataIndex: 'category' },
            { title: 'Izoh', dataIndex: 'note', render: (v) => v || '—' },
            { title: 'Summa', dataIndex: 'amount', align: 'right', render: (v) => <b className="num">{money(v)}</b> },
            isAdmin && {
              width: 50,
              render: (_, e) => (
                <Popconfirm title="O'chirilsinmi?" onConfirm={() => remove(e)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ].filter(Boolean)}
        />
      </Card>
      <ExpenseModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
