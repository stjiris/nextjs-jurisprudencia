import { Html, Head, Main, NextScript, DocumentProps } from 'next/document'

export default function Document(props: DocumentProps) {
  const base_path = process.env.NEXT_BASE_PATH || ''
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href={`${base_path}/favicon.ico`} />
      </Head>      
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
