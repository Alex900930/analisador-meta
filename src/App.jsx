import React, { useState, useRef } from 'react'
import './App.css'

const DEFAULT_CONFIG = {
  ctrMin: 0.50,
  ctrBom: 1.00,
  ctrOtimo: 2.00,
  freqMax: 2.50,
  cpmMax: 9.00,
  cpcMax: 30.00,
}

function findCol(obj, candidates) {
  for (const c of candidates) {
    const key = Object.keys(obj).find(k =>
      k.toLowerCase().includes(c.toLowerCase())
    )
    if (key) return key
  }
  return null
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    if (vals.length < 3) continue
    const obj = {}
    headers.forEach((h, idx) => (obj[h] = vals[idx] || ''))
    rows.push(obj)
  }
  return rows
}

function analyzeAds(rows, cfg) {
  const sample = rows[0] || {}
  const colNome = findCol(sample, ['Nome do anúncio', 'nome do an'])
  const colConversas = findCol(sample, ['Conversas por mensagem', 'conversas por men'])
  const colCPC = findCol(sample, ['Custo por conversa', 'custo por conversa por men'])
  const colFreq = findCol(sample, ['Frequência', 'Frequencia', 'frequencia'])
  const colCPM = findCol(sample, ['CPM', 'Custo por 1000'])
  const colCTR = findCol(sample, ['CTR', 'taxa de cliques na ligação', 'taxa de cliques'])
  const colStatus = findCol(sample, ['Apresentação', 'apresentacao', 'status', 'Apresenta'])

  const ativos = rows.filter(r => {
    const status = colStatus ? r[colStatus] : ''
    return (
      status.toLowerCase() === 'active' ||
      status.toLowerCase() === 'ativo' ||
      status === ''
    )
  })

  return ativos.map(r => {
    const nome = colNome ? r[colNome] : 'Sem nome'
    const conversas = parseFloat(colConversas ? r[colConversas] : '') || 0
    const cpc = parseFloat(colCPC ? r[colCPC] : '') || 0
    const freq = parseFloat(colFreq ? r[colFreq] : '') || 0
    const cpm = parseFloat(colCPM ? r[colCPM] : '') || 0
    const ctr = parseFloat(colCTR ? r[colCTR] : '') || 0

    const problemas = []
    const positivos = []

    if (ctr > 0 && ctr < cfg.ctrMin) problemas.push(`CTR baixo (${ctr.toFixed(2)}%)`)
    else if (ctr >= cfg.ctrOtimo) positivos.push(`CTR ótimo (${ctr.toFixed(2)}%)`)
    else if (ctr >= cfg.ctrBom) positivos.push(`CTR muito bom (${ctr.toFixed(2)}%)`)
    else if (ctr >= cfg.ctrMin) positivos.push(`CTR ok (${ctr.toFixed(2)}%)`)

    if (freq >= cfg.freqMax) problemas.push(`Frequência alta (${freq.toFixed(2)})`)
    else if (freq > 0) positivos.push(`Frequência ok (${freq.toFixed(2)})`)

    if (cpm > cfg.cpmMax) problemas.push(`CPM alto (R$${cpm.toFixed(2)})`)
    else if (cpm > 0) positivos.push(`CPM viável (R$${cpm.toFixed(2)})`)

    if (cpc > 0 && cpc > cfg.cpcMax) problemas.push(`Custo/conversa alto (R$${cpc.toFixed(2)})`)
    else if (cpc > 0) positivos.push(`Custo/conversa ok (R$${cpc.toFixed(2)})`)

    let decisao = 'manter'
    if (freq >= cfg.freqMax) decisao = 'pausar'
    else if (conversas === 0 && ctr > 0 && ctr < cfg.ctrMin) decisao = 'pausar'
    else if (problemas.length >= 2) decisao = 'pausar'
    else if (problemas.length === 1) decisao = 'monitorar'

    let justificativa = ''
    if (decisao === 'pausar') {
      if (freq >= cfg.freqMax)
        justificativa = `Frequência de ${freq.toFixed(2)} indica audiência saturada. Mesmo com resultados, o anúncio está desgastado. Pausar e renovar criativo.`
      else if (conversas === 0)
        justificativa = `Sem conversas iniciadas e CTR abaixo do mínimo (${ctr > 0 ? ctr.toFixed(2) + '%' : 'sem dados'}). Não está entregando resultado. Pausar e criar nova variação.`
      else
        justificativa = `Múltiplos indicadores negativos: ${problemas.join(', ')}. Custo-benefício abaixo do aceitável.`
    } else if (decisao === 'monitorar') {
      justificativa = `${positivos.join(', ')}. Ponto de atenção: ${problemas.join(', ')}. Acompanhar mais uma semana antes de decidir.`
    } else {
      justificativa = `${positivos.join(', ')}${conversas > 0 ? ` — ${conversas} conversas iniciadas` : ''}. Manter rodando.`
    }

    return { nome, conversas, cpc, freq, cpm, ctr, decisao, justificativa }
  })
}

function gerarRelatorio(ads, cliente) {
  const data = new Date().toLocaleDateString('pt-BR')
  let texto = `📊 ANÁLISE SEMANAL — META ADS\n`
  if (cliente) texto += `Cliente: ${cliente}\n`
  texto += `Data: ${data}\n`
  texto += `─────────────────────────────\n\n`
  texto += `Total analisado: ${ads.length} anúncios ativos\n`
  texto += `Conversas iniciadas: ${ads.reduce((s, a) => s + a.conversas, 0)}\n\n`

  const ordem = ['pausar', 'monitorar', 'manter']
  const sorted = [...ads].sort((a, b) => ordem.indexOf(a.decisao) - ordem.indexOf(b.decisao))

  sorted.forEach(a => {
    const emoji = a.decisao === 'manter' ? '✅' : a.decisao === 'pausar' ? '🔴' : '⚠️'
    texto += `${emoji} ${a.nome}\n`
    texto += `   Decisão: ${a.decisao.toUpperCase()}\n`
    if (a.conversas > 0) texto += `   Conversas: ${a.conversas} | Custo/conversa: R$${a.cpc.toFixed(2)}\n`
    texto += `   CTR: ${a.ctr.toFixed(2)}% | Frequência: ${a.freq.toFixed(2)} | CPM: R$${a.cpm.toFixed(2)}\n`
    texto += `   ${a.justificativa}\n\n`
  })
  return texto
}

export default function App() {
  const [cfg, setCfg] = useState(DEFAULT_CONFIG)
  const [ads, setAds] = useState(null)
  const [cliente, setCliente] = useState('')
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showRelatorio, setShowRelatorio] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef()

  function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const rows = parseCSV(e.target.result)
      const result = analyzeAds(rows, cfg)
      setAds(result)
      setShowRelatorio(false)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  function copiar() {
    const texto = gerarRelatorio(ads, cliente)
    navigator.clipboard.writeText(texto).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function resetar() {
    setAds(null)
    setFileName('')
    setShowRelatorio(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const mantendo = ads ? ads.filter(a => a.decisao === 'manter').length : 0
  const monitorando = ads ? ads.filter(a => a.decisao === 'monitorar').length : 0
  const pausando = ads ? ads.filter(a => a.decisao === 'pausar').length : 0
  const totalConversas = ads ? ads.reduce((s, a) => s + a.conversas, 0) : 0

  const sorted = ads
    ? [...ads].sort((a, b) =>
        ['pausar', 'monitorar', 'manter'].indexOf(a.decisao) -
        ['pausar', 'monitorar', 'manter'].indexOf(b.decisao)
      )
    : []

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div>
            <h1 className="header-title">Analisador Meta Ads</h1>
            <p className="header-sub">Crescer Pro — uso interno</p>
          </div>
          {ads && (
            <button className="btn-reset" onClick={resetar}>
              Nova análise
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {!ads && (
          <>
            <section className="config-section">
              <h2 className="section-label">Critérios de análise</h2>
              <div className="config-grid">
                {[
                  { key: 'ctrMin', label: 'CTR mínimo (%)', step: 0.05 },
                  { key: 'ctrBom', label: 'CTR bom (%)', step: 0.05 },
                  { key: 'ctrOtimo', label: 'CTR ótimo (%)', step: 0.05 },
                  { key: 'freqMax', label: 'Frequência máx.', step: 0.1 },
                  { key: 'cpmMax', label: 'CPM máx. (R$)', step: 0.5 },
                  { key: 'cpcMax', label: 'Custo/conversa máx. (R$)', step: 1 },
                ].map(({ key, label, step }) => (
                  <div key={key} className="config-card">
                    <label className="config-label">{label}</label>
                    <input
                      type="number"
                      className="config-input"
                      value={cfg[key]}
                      step={step}
                      onChange={e =>
                        setCfg(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="config-section">
              <h2 className="section-label">Cliente (opcional)</h2>
              <input
                type="text"
                className="cliente-input"
                placeholder="Ex: Dr. Tiago Rêgo"
                value={cliente}
                onChange={e => setCliente(e.target.value)}
              />
            </section>

            <div
              className={`upload-area ${dragging ? 'dragging' : ''}`}
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <div className="upload-icon">↑</div>
              <p className="upload-title">Arraste o CSV aqui ou clique para selecionar</p>
              <p className="upload-hint">
                Ads Manager → Relatórios → Exportar CSV (somente anúncios ativos, campanha de mensagens)
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          </>
        )}

        {ads && (
          <>
            <div className="file-badge">📄 {fileName}</div>

            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-num">{ads.length}</div>
                <div className="summary-lbl">Analisados</div>
              </div>
              <div className="summary-card green">
                <div className="summary-num">{mantendo}</div>
                <div className="summary-lbl">Manter</div>
              </div>
              <div className="summary-card amber">
                <div className="summary-num">{monitorando}</div>
                <div className="summary-lbl">Monitorar</div>
              </div>
              <div className="summary-card red">
                <div className="summary-num">{pausando}</div>
                <div className="summary-lbl">Pausar</div>
              </div>
              <div className="summary-card">
                <div className="summary-num">{totalConversas}</div>
                <div className="summary-lbl">Conversas</div>
              </div>
            </div>

            <div className="ads-list">
              {sorted.map((a, i) => (
                <div key={i} className={`ad-card decisao-${a.decisao}`}>
                  <div className="ad-header">
                    <span className="ad-name">{a.nome}</span>
                    <span className={`badge badge-${a.decisao}`}>
                      {a.decisao === 'manter' ? '✅' : a.decisao === 'pausar' ? '🔴' : '⚠️'}{' '}
                      {a.decisao.charAt(0).toUpperCase() + a.decisao.slice(1)}
                    </span>
                  </div>

                  <div className="metrics-row">
                    <MetricChip
                      label="CTR"
                      value={a.ctr > 0 ? `${a.ctr.toFixed(2)}%` : '—'}
                      status={a.ctr >= cfg.ctrOtimo ? 'ok' : a.ctr >= cfg.ctrMin ? 'ok' : 'bad'}
                    />
                    <MetricChip
                      label="Frequência"
                      value={a.freq > 0 ? a.freq.toFixed(2) : '—'}
                      status={a.freq >= cfg.freqMax ? 'bad' : 'ok'}
                    />
                    <MetricChip
                      label="CPM"
                      value={a.cpm > 0 ? `R$${a.cpm.toFixed(2)}` : '—'}
                      status={a.cpm > cfg.cpmMax ? 'warn' : 'ok'}
                    />
                    {a.cpc > 0 && (
                      <MetricChip
                        label="Custo/conversa"
                        value={`R$${a.cpc.toFixed(2)}`}
                        status={a.cpc > cfg.cpcMax ? 'bad' : 'ok'}
                      />
                    )}
                    {a.conversas > 0 && (
                      <MetricChip label="Conversas" value={a.conversas} status="ok" />
                    )}
                  </div>

                  <p className="justificativa">{a.justificativa}</p>
                </div>
              ))}
            </div>

            <div className="relatorio-section">
              <button
                className="btn-relatorio"
                onClick={() => setShowRelatorio(v => !v)}
              >
                {showRelatorio ? 'Ocultar texto' : '📋 Ver bloco para relatório'}
              </button>

              {showRelatorio && (
                <>
                  <pre className="relatorio-text">{gerarRelatorio(ads, cliente)}</pre>
                  <button className="btn-copiar" onClick={copiar}>
                    {copied ? '✓ Copiado!' : 'Copiar texto'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function MetricChip({ label, value, status }) {
  return (
    <span className={`metric-chip status-${status}`}>
      {label}: <strong>{value}</strong>
    </span>
  )
}
