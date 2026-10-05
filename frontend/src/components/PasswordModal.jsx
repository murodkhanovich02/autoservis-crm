import { App, Form, Input, Modal } from 'antd'
import { useState } from 'react'
import { errorText, post } from '../api'

export default function PasswordModal({ open, onClose }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()

  const submit = async (values) => {
    setSaving(true)
    try {
      await post('/auth/change-password', { old_password: values.old_password, new_password: values.new_password })
      message.success("Parol o'zgartirildi")
      form.resetFields()
      onClose()
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Parolni o'zgartirish"
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText="Saqlash"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="old_password" label="Joriy parol" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="new_password" label="Yangi parol" rules={[{ required: true, min: 6 }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="Yangi parolni takrorlang"
          dependencies={['new_password']}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator: (_, v) =>
                !v || getFieldValue('new_password') === v ? Promise.resolve() : Promise.reject(new Error('Parollar mos emas')),
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  )
}
