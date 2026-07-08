import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './style.css'

// 字体本地引入（无 CDN）
import '@fontsource/bricolage-grotesque/400.css'
import '@fontsource/bricolage-grotesque/500.css'
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/bricolage-grotesque/800.css'
import '@fontsource/sora/300.css'
import '@fontsource/sora/400.css'
import '@fontsource/sora/500.css'
import '@fontsource/sora/600.css'
import '@fontsource/sora/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'

// ErrorBoundary: catch render crashes so the app shows a fallback instead of a white screen.
// localStorage data is left untouched - user can refresh or export archives to recover.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // No remote reporting (MVP). Log to console for dev debugging.
    console.error('Render error caught:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
          background: '#0a0e14', color: '#dde4f0', fontFamily: 'sans-serif',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>应用出现错误</div>
          <div style={{ fontSize: '13px', color: '#8893a7', maxWidth: '420px', textAlign: 'center', lineHeight: 1.6 }}>
            页面渲染时发生异常。你的项目数据仍保存在本地，不会丢失。<br />
            请刷新页面重试；如反复出错，可在新标签页打开后尽快导出项目归档备份。
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px', padding: '8px 20px', cursor: 'pointer',
              background: '#1f2937', color: '#dde4f0', border: '1px solid #2e3a4f',
              borderRadius: '6px', fontSize: '13px', fontWeight: 500,
            }}
          >
            刷新页面
          </button>
          <div style={{ fontSize: '11px', color: '#5a6577', marginTop: '12px', maxWidth: '600px', wordBreak: 'break-all' }}>
            {String(this.state.error)}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
