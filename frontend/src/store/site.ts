import { makeAutoObservable, runInAction } from 'mobx'
import { getSite } from '../api/site'
import type { SiteDocument } from '../types/site'

class SiteStore {
  document: SiteDocument | null = null
  loading = false
  error = ''
  private loadVersion = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async load(): Promise<void> {
    if (this.loading) return
    const version = ++this.loadVersion
    this.loading = true
    this.error = ''
    try {
      const document = await getSite()
      runInAction(() => {
        if (version === this.loadVersion) this.document = document
      })
    } catch (error) {
      runInAction(() => {
        if (version !== this.loadVersion) return
        this.error = error instanceof Error ? error.message : '暂时无法读取网站内容'
      })
    } finally {
      runInAction(() => {
        if (version === this.loadVersion) this.loading = false
      })
    }
  }
}

export const siteStore = new SiteStore()
