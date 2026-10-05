import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Switch, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { errorText, get, patch, post } from '../api'
import { useAuth } from '../auth'
import { PageHead, StatusTag } from '../components/common'
import { fmtDate, fmtPhone, ROLES } from '../utils'

function UserModal({ open, onClose, user }) {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const role = Form.useWatch('role', form)

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (user)
        form.setFieldsValue({ ...user, phone: user.phone?.replace(/^998/, ''), commission_percent: Number(user.commission_percent) })
    }
  }, [open, user, form])

  const submit = async (v) => {
    setSaving(true)
    const payload = { ...v }
    if (user && !payload.password) delete payload.password
    try {
      if (user) {
        delete payload.username
        await patch(`/users/${user.id}`, payload)
      } else await post('/users', payload)
      qc.invalidateQueries({ queryKey: ['users'] })
      message.success('Saqlandi')
      onClose()
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={user ? 'Xodimni tahrirlash' : 'Yangi xodim'}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText="Saqlash"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ role: 'mechanic', is_active: true, commission_percent: 0 }}>
        <Form.Item name="full_name" label="F.I.Sh." rules={[{ required: true, min: 2 }]}>
          <Input />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="username"
              label="Login"
              rules={[{ required: !user, min: 3, pattern: /^[a-zA-Z0-9_.]+$/, message: 'Lotin harflari, raqamlar' }]}
            >
              <Input disabled={Boolean(user)} autoComplete="off" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="password"
              label={user ? 'Yangi parol' : 'Parol'}
              rules={[{ required: !user, min: 6, message: 'Kamida 6 belgi' }]}
              extra={user ? "O'zgartirmaslik uchun bo'sh qoldiring" : undefined}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="role" label="Lavozim">
              <Select options={Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="Telefon">
              <Input prefix="+998" />
            </Form.Item>
          </Col>
          {role === 'mechanic' && (
            <Col span={12}>
              <Form.Item name="commission_percent" label="Ish haqi foizi" tooltip="Bajargan xizmatlar summasidan">
                <InputNumber min={0} max={100} suffix="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
          <Col span={12}>
            <Form.Item name="is_active" label="Faol" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const [modal, setModal] = useState({ open: false, user: null })
  const { data = [], isFetching } = useQuery({ queryKey: ['users', 'all'], queryFn: () => get('/users') })

  return (
    <>
      <PageHead
        title="Xodimlar"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true, user: null })}>
            Yangi xodim
          </Button>
        }
      />
      <Card size="small">
        <Table
          rowKey="id"
          loading={isFetching}
          dataSource={data}
          pagination={false}
          scroll={{ x: 700 }}
          columns={[
            {
              title: 'F.I.Sh.',
              dataIndex: 'full_name',
              render: (v, u) => (
                <>
                  <b>{v}</b> {u.id === me.id && <Tag>siz</Tag>}
                  {!u.is_active && <Tag color="red">bloklangan</Tag>}
                </>
              ),
            },
            { title: 'Login', dataIndex: 'username' },
            { title: 'Lavozim', dataIndex: 'role', render: (r) => <StatusTag status={r} map={ROLES} /> },
            { title: 'Telefon', dataIndex: 'phone', render: (v) => (v ? fmtPhone(v) : '—') },
            { title: 'Foiz', dataIndex: 'commission_percent', render: (v, u) => (u.role === 'mechanic' ? `${Number(v)}%` : '—') },
            { title: "Qo'shilgan", dataIndex: 'created_at', render: fmtDate },
            {
              width: 50,
              render: (_, u) => <Button size="small" icon={<EditOutlined />} onClick={() => setModal({ open: true, user: u })} />,
            },
          ]}
        />
      </Card>
      <UserModal open={modal.open} user={modal.user} onClose={() => setModal({ open: false, user: null })} />
    </>
  )
}
