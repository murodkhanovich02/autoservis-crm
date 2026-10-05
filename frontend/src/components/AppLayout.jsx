import {
  AppstoreOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CarOutlined,
  DashboardOutlined,
  DownOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Badge, Button, Drawer, Dropdown, Grid, Layout, Menu, Space, Spin, Typography } from 'antd'
import { Suspense, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { get } from '../api'
import { useAuth } from '../auth'
import { ROLES } from '../utils'
import PasswordModal from './PasswordModal'

const { Header, Sider, Content } = Layout

function useMenuItems(newAppointments) {
  const { user } = useAuth()
  const role = user?.role
  const staff = role === 'admin' || role === 'manager'
  return [
    staff && { key: '/', icon: <DashboardOutlined />, label: 'Bosh sahifa' },
    { key: '/orders', icon: <CarOutlined />, label: 'Buyurtmalar' },
    {
      key: '/appointments',
      icon: <CalendarOutlined />,
      label: (
        <Space>
          Navbat
          {newAppointments > 0 && <Badge count={newAppointments} size="small" />}
        </Space>
      ),
    },
    { key: '/customers', icon: <TeamOutlined />, label: 'Mijozlar' },
    { key: '/services', icon: <ToolOutlined />, label: 'Xizmatlar' },
    { key: '/parts', icon: <AppstoreOutlined />, label: 'Ombor' },
    staff && { type: 'divider' },
    staff && { key: '/reports', icon: <BarChartOutlined />, label: 'Hisobotlar' },
    staff && { key: '/expenses', icon: <WalletOutlined />, label: 'Xarajatlar' },
    staff && { key: '/sms', icon: <MessageOutlined />, label: 'SMS' },
    role === 'admin' && { key: '/users', icon: <UserOutlined />, label: 'Xodimlar' },
    role === 'admin' && { key: '/settings', icon: <SettingOutlined />, label: 'Sozlamalar' },
  ].filter(Boolean)
}

function Brand({ collapsed }) {
  return (
    <div style={{ height: 64, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', color: '#fff' }}>
      <img src="/favicon.svg" width={30} height={30} alt="" />
      {!collapsed && <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: 0.3 }}>AutoServis CRM</span>}
    </div>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.lg
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)

  const { data: newCount } = useQuery({
    queryKey: ['appointments', 'new-count'],
    queryFn: () => get('/appointments/new-count'),
    refetchInterval: 60_000,
  })
  const items = useMenuItems(newCount?.count || 0)

  const selected = '/' + (location.pathname.split('/')[1] || '')
  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selected]}
      items={items}
      onClick={({ key }) => {
        navigate(key)
        setDrawerOpen(false)
      }}
    />
  )

  const userMenu = {
    items: [
      { key: 'password', icon: <KeyOutlined />, label: "Parolni o'zgartirish" },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Chiqish', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout()
        navigate('/login')
      } else setPwdOpen(true)
    },
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          size={250}
          closable={false}
          styles={{ body: { padding: 0, background: '#0f1b2d' } }}
        >
          <Brand />
          {menu}
        </Drawer>
      ) : (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={230}
          style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
        >
          <Brand collapsed={collapsed} />
          {menu}
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e5e7eb',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            {isMobile && <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />}
          </div>
          <Dropdown menu={userMenu} trigger={['click']}>
            <Button type="text" style={{ height: 48 }}>
              <Space>
                <Avatar style={{ background: '#1668dc' }}>{user?.full_name?.[0]}</Avatar>
                {!isMobile && (
                  <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
                    <div>{user?.full_name}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {ROLES[user?.role]?.label}
                    </Typography.Text>
                  </span>
                )}
                <DownOutlined style={{ fontSize: 10 }} />
              </Space>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ padding: isMobile ? 12 : 24 }}>
          <Suspense fallback={<Spin style={{ display: 'block', margin: '80px auto' }} />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
      <PasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </Layout>
  )
}
