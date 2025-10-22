import React, { useEffect, useMemo, useRef, useState } from 'react'

type AnyEvent = MouseEvent | React.MouseEvent | Event

function formatNode(node: Element | null | undefined): string {
  if (!node) return '(null)'
  const id = (node as HTMLElement).id ? `#${(node as HTMLElement).id}` : ''
  const cls = (node as HTMLElement).className ? `.${String((node as HTMLElement).className).split(' ').join('.')}` : ''
  return `${node.tagName.toLowerCase()}${id}${cls}`
}

function formatPath(path: any): string {
  if (!path || !Array.isArray(path)) return ''
  return path
    .filter((n) => n && n.nodeType === 1)
    .map((n: Element) => formatNode(n))
    .join(' > ')
}

const UploadDiagnostic: React.FC = () => {
  // Logging
  const [logLines, setLogLines] = useState<string[]>([])
  const nowISO = () => new Date().toISOString()
  const log = (message: string, extra?: unknown) => {
    const line = `[${nowISO()}] ${message}`
    setLogLines((prev) => [...prev.slice(-500), line])
    if (extra !== undefined) console.log(line, extra)
    else console.log(line)
  }

  // State toggles
  const [noStyles, setNoStyles] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [overlayBlocks, setOverlayBlocks] = useState(true) // pointer-events: auto vs none
  const [lastMouse, setLastMouse] = useState<{ x: number; y: number }>({ x: -1, y: -1 })

  // Refs
  const rootRef = useRef<HTMLDivElement>(null)
  const reactBtnRef = useRef<HTMLButtonElement>(null)
  const nativeBtnRef = useRef<HTMLButtonElement>(null)
  const fixedBtnRef = useRef<HTMLButtonElement>(null)
  const absoluteBtnRef = useRef<HTMLButtonElement>(null)
  const bodyDomButtonRef = useRef<HTMLButtonElement | null>(null)

  // Mouse position tracker
  useEffect(() => {
    const onMove = (e: MouseEvent) => setLastMouse({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // Document/body native listeners (capture + bubble)
  useEffect(() => {
    const logNative = (where: string, phase: 'capture' | 'bubble') => (e: AnyEvent) => {
      try {
        const native = e as MouseEvent
        const path = (native.composedPath && native.composedPath()) || []
        const prevented = native.defaultPrevented
        const cancelBubble = (native as any).cancelBubble
        log(`${where} ${phase} click: target=${formatNode(native.target as Element)} currentTarget=${formatNode(native.currentTarget as Element)} prevented=${prevented} cancelBubble=${cancelBubble} path=${formatPath(path)}`)
      } catch (err) {
        log(`${where} ${phase} click: error logging`, err)
      }
    }

    document.addEventListener('click', logNative('document', 'capture'), true)
    document.addEventListener('click', logNative('document', 'bubble'), false)
    document.body.addEventListener('click', logNative('body', 'capture'), true)
    document.body.addEventListener('click', logNative('body', 'bubble'), false)

    return () => {
      document.removeEventListener('click', logNative('document', 'capture'), true)
      document.removeEventListener('click', logNative('document', 'bubble'), false)
      document.body.removeEventListener('click', logNative('body', 'capture'), true)
      document.body.removeEventListener('click', logNative('body', 'bubble'), false)
    }
  }, [])

  // Native listener on the "Native Button"
  useEffect(() => {
    const btn = nativeBtnRef.current
    if (!btn) return
    const nativeHandler = (e: MouseEvent) => {
      const path = (e.composedPath && e.composedPath()) || []
      log(`nativeBtn native listener: target=${formatNode(e.target as Element)} currentTarget=${formatNode(e.currentTarget as Element)} prevented=${e.defaultPrevented} path=${formatPath(path)}`)
    }
    btn.addEventListener('click', nativeHandler)
    return () => btn.removeEventListener('click', nativeHandler)
  }, [])

  // Component root capture + bubble via React
  const onRootCapture = (e: React.MouseEvent) => {
    const path = (e.nativeEvent as any).composedPath?.() || []
    const stopped = typeof (e as any).isPropagationStopped === 'function' ? (e as any).isPropagationStopped() : false
    log(`root onClickCapture: target=${formatNode(e.target as Element)} currentTarget=${formatNode(e.currentTarget as Element)} defaultPrevented=${e.isDefaultPrevented()} stopped=${stopped} path=${formatPath(path)}`)
  }
  const onRootBubble = (e: React.MouseEvent) => {
    const path = (e.nativeEvent as any).composedPath?.() || []
    const stopped = typeof (e as any).isPropagationStopped === 'function' ? (e as any).isPropagationStopped() : false
    log(`root onClick: target=${formatNode(e.target as Element)} currentTarget=${formatNode(e.currentTarget as Element)} defaultPrevented=${e.isDefaultPrevented()} stopped=${stopped} path=${formatPath(path)}`)
  }

  // Direct DOM button (in body) for isolation
  const spawnBodyButton = () => {
    if (bodyDomButtonRef.current) return
    const btn = document.createElement('button')
    btn.textContent = 'Body DOM Button (native)'
    btn.style.position = 'fixed'
    btn.style.top = '8px'
    btn.style.left = '8px'
    btn.style.zIndex = '999999'
    btn.style.padding = '6px 10px'
    btn.style.background = '#047857'
    btn.style.color = 'white'
    btn.style.border = '1px solid #064e3b'
    btn.style.borderRadius = '6px'
    const handler = (e: MouseEvent) => {
      const path = (e.composedPath && e.composedPath()) || []
      log(`Body DOM Button native click: target=${formatNode(e.target as Element)} prevented=${e.defaultPrevented} path=${formatPath(path)}`)
    }
    btn.addEventListener('click', handler)
    document.body.appendChild(btn)
    bodyDomButtonRef.current = btn
  }
  const removeBodyButton = () => {
    if (!bodyDomButtonRef.current) return
    const btn = bodyDomButtonRef.current
    btn.remove()
    bodyDomButtonRef.current = null
  }

  // Hit testing helpers
  const hitTestAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as Element | null
    const chain: string[] = []
    let cur: Element | null = el
    while (cur) {
      chain.push(formatNode(cur))
      cur = cur.parentElement
    }
    log(`elementFromPoint(${x}, ${y}) -> ${formatNode(el)} chain=${chain.join(' < ')}`)
  }

  const center = useMemo(() => ({ x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) }), [])

  // Styles (conditionally disabled)
  const containerStyle = noStyles
    ? undefined
    : { padding: '1rem', color: 'white' as const }

  return (
    <>
      {/* 1) Completely isolated test button, minimal/no styling, top-level */}
      <button
        onClick={() => log('Isolated React onClick fired (top-level)')}
        style={{ margin: 6, padding: '6px 10px', border: '1px solid #374151', borderRadius: 6, background: '#111827', color: 'white', cursor: 'pointer' }}
      >Isolated Test Button (React)</button>

      {/* 2) Diagnostic component root */}
      <div ref={rootRef} onClickCapture={onRootCapture} onClick={onRootBubble} style={containerStyle}>
        <h1 style={noStyles ? undefined : { fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Upload Diagnostic</h1>

        {/* Controls */}
        <div style={noStyles ? undefined : { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <button onClick={() => setNoStyles((v) => { const n = !v; log(`Toggle noStyles -> ${n}`); return n })} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#374151', color: 'white', borderRadius: '0.5rem', border: '1px solid #475569', cursor: 'pointer' }}>Toggle No Styles</button>
          <button onClick={() => setShowOverlay((v) => { const n = !v; log(`Toggle overlay -> ${n}`); return n })} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#1f2937', color: 'white', borderRadius: '0.5rem', border: '1px solid #475569', cursor: 'pointer' }}>{showOverlay ? 'Hide' : 'Show'} Debug Overlay</button>
          <button onClick={() => setOverlayBlocks((v) => { const n = !v; log(`Overlay blocks -> ${n}`); return n })} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: overlayBlocks ? '#b91c1c' : '#047857', color: 'white', borderRadius: '0.5rem', border: '1px solid #475569', cursor: 'pointer' }}>{overlayBlocks ? 'Overlay: pointer-events auto' : 'Overlay: pointer-events none'}</button>
          <button onClick={() => hitTestAt(center.x, center.y)} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#0f172a', color: 'white', borderRadius: '0.5rem', border: '1px solid #475569', cursor: 'pointer' }}>Hit Test (center)</button>
          <button onClick={() => hitTestAt(lastMouse.x, lastMouse.y)} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#0f172a', color: 'white', borderRadius: '0.5rem', border: '1px solid #475569', cursor: 'pointer' }}>Hit Test (last mouse)</button>
          <button onClick={spawnBodyButton} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#065f46', color: 'white', borderRadius: '0.5rem', border: '1px solid #475569', cursor: 'pointer' }}>Spawn Body DOM Button</button>
          <button onClick={removeBodyButton} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#7f1d1d', color: 'white', borderRadius: '0.5rem', border: '1px solid #475569', cursor: 'pointer' }}>Remove Body DOM Button</button>
          <button onClick={() => { const t = document.body.style.pointerEvents || '(inherit)'; log(`Body style pointer-events=${t}`) }} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#1e40af', color: 'white', borderRadius: '0.5rem', border: '1px solid #475569', cursor: 'pointer' }}>Log body pointer-events</button>
        </div>

        {/* 3) Buttons using different wiring methods */}
        <div style={noStyles ? undefined : { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {/* React onClick */}
          <button ref={reactBtnRef} onClick={(e) => { log('React button onClick fired'); }} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}>React onClick Button</button>

          {/* Native addEventListener on the same button */}
          <button ref={nativeBtnRef} onClick={() => log('Native button React onClick fired (should also have native listener)')} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}>Native addEventListener Button</button>

          {/* React button that stops propagation */}
          <button onClick={(e) => { e.stopPropagation(); log('React button stopPropagation called'); }} style={noStyles ? undefined : { padding: '0.5rem 1rem', backgroundColor: '#f59e0b', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}>Stop Propagation Button</button>
        </div>

        {/* 4) Buttons at different positions */}
        <div style={noStyles ? undefined : { position: 'relative', height: 120, border: '1px dashed #334155', borderRadius: 8, padding: 8, marginBottom: '0.75rem' }}>
          <button ref={fixedBtnRef} onClick={() => log('Fixed-position button React onClick')} style={noStyles ? undefined : { position: 'fixed', top: 60, right: 12, zIndex: 9999, padding: '0.5rem 1rem', backgroundColor: '#7c3aed', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}>Fixed Top-Right</button>
          <button ref={absoluteBtnRef} onClick={() => log('Absolute-position button React onClick')} style={noStyles ? undefined : { position: 'absolute', bottom: 8, left: 8, padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}>Absolute Bottom-Left</button>
          <button onClick={() => log('Relative-position button React onClick')} style={noStyles ? undefined : { position: 'relative', padding: '0.5rem 1rem', backgroundColor: '#475569', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}>Relative Button</button>
        </div>

        {/* 5) Log area */}
        <div style={noStyles ? undefined : { maxHeight: 240, overflow: 'auto', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: 6, padding: '0.5rem', color: '#cbd5e1', fontSize: 12 }}>
          {logLines.length === 0 ? <div>No logs yet</div> : logLines.map((line, idx) => <div key={idx}>{line}</div>)}
        </div>
      </div>

      {/* 4) Optional debug overlay to test if something blocks clicks */}
      {showOverlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(220, 38, 38, 0.15)',
            zIndex: 9998,
            pointerEvents: overlayBlocks ? 'auto' : 'none'
          }}
          onClick={() => log(`Debug overlay received click (blocking=${overlayBlocks})`) }
        />
      )}
    </>
  )
}

export default UploadDiagnostic


