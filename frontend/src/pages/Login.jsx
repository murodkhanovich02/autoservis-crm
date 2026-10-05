import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { errorText } from '../api'
import { useAuth } from '../auth'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async ({ username, password }) => {
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: 'linear-gradient(135deg, #0f1b2d 0%, #1d3557 100%)',
      }}
    >
      <Card style={{ width: '100%', maxWidth: 380 }} styles={{ body: { padding: 32 } }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/favicon.svg" width={52} height={52} alt="" />
          <Typography.Title level={3} style={{ margin: '12px 0 4px' }}>
            AutoServis CRM
          </Typography.Title>
          <Typography.Text type="secondary">Tizimga kirish</Typography.Text>
        </div>
        {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={submit} size="large">
          <Form.Item name="username" rules={[{ required: true, message: 'Loginni kiriting' }]}>
            <Input prefix={<UserOutlined />} placeholder="Login" autoFocus autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Parolni kiriting' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Parol" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Kirish
          </Button>
        </Form>
      </Card>
    </div>
  )
}
