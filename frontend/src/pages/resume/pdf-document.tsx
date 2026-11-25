import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url'
import styles from './style.module.less'

GlobalWorkerOptions.workerSrc = workerUrl

// 固定 2 倍渲染：Retina 下清晰，页面宽度变化时无需重绘。
const RENDER_SCALE = 2

function isCancelled(error: unknown) {
  return error instanceof Error && error.name === 'RenderingCancelledException'
}

function PdfPage({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let renderTask: ReturnType<PDFPageProxy['render']> | null = null
    void pdf.getPage(pageNumber).then(page => {
      const canvas = canvasRef.current
      if (!active || !canvas) return
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      renderTask = page.render({ canvas, viewport })
      return renderTask.promise.catch(error => {
        if (active && !isCancelled(error)) setFailed(true)
      })
    }).catch(() => {
      if (active) setFailed(true)
    })
    return () => {
      active = false
      renderTask?.cancel()
    }
  }, [pdf, pageNumber])

  if (failed) {
    return <p className={styles.pdfPageError} role="alert">第 {pageNumber} 页渲染失败，请下载 PDF 查看。</p>
  }
  return <canvas ref={canvasRef} className={styles.pdfPage} role="img" aria-label={`简历第 ${pageNumber} 页`} />
}

interface ResumePdfDocumentProps {
  url: string
  title: string
}

export function ResumePdfDocument({ url, title }: ResumePdfDocumentProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const loadingTask = getDocument({ url })
    void loadingTask.promise.then(next => {
      if (!active) {
        void loadingTask.destroy()
        return
      }
      setPdf(next)
      setStatus('ready')
    }).catch(() => {
      if (active) setStatus('error')
    })
    return () => {
      active = false
      void loadingTask.destroy()
    }
  }, [attempt, url])

  return <div className={styles.pdfDocument} role="group" aria-label={title}>
    {status === 'loading' && <p className={`${styles.status} ${styles.pdfStatus}`} role="status">正在加载简历…</p>}
    {status === 'error' && <div className={`${styles.status} ${styles.pdfStatus}`} role="alert">
      <p>简历 PDF 加载失败，可重试或直接下载查看。</p>
      <p>
        <button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>重新加载</button>
        <a href={url} download>下载 PDF</a>
      </p>
    </div>}
    {status === 'ready' && pdf && Array.from({ length: pdf.numPages }, (_, index) =>
      <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} />)}
  </div>
}
