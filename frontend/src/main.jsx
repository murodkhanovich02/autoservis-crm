import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import uzUZ from 'antd/locale/uz_UZ'
import dayjs from 'dayjs'
import 'dayjs/locale/uz-latn'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import './index.css'

dayjs.locale('uz-latn')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
})

const theme = {
  token: {
    colorPrimary: '#1668dc',
    borderRadius: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: { siderBg: '#0f1b2d', headerBg: '#ffffff' },
    Menu: { darkItemBg: '#0f1b2d', darkSubMenuItemBg: '#0b1524' },
  },
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={uzUZ} theme={theme}>
        <AntApp>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
)
