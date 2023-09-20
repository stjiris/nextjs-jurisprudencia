import '@/styles/globals.css'
import '@/styles/highlight-style.css'
import "@/styles/pesquisa.css"
import '@/styles/dashboard.css'

import type { AppProps } from 'next/app'

export default function App({ Component, pageProps}: AppProps) {
  return <Component {...pageProps} />
}
