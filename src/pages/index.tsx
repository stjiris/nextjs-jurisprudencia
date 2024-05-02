import Head from 'next/head'
import GenericPage from '@/components/genericPageStructure'
import Link from 'next/link'
import { GetServerSideProps } from 'next'
import { LoggerServerSideProps } from '@/core/logger-api'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  LoggerServerSideProps(ctx);
  return {redirect: {destination: "/pesquisa"}, props: {}}
}

export default function Home() {
  return (
    <GenericPage>
      <Head>
        <title>Jurisprudência STJ - Página Inicial</title>
        <meta name="description" content="Permite explorar, pesquisar e filtrar os acórdãos publicados pelo Supremo Tribunal de Justiça na DGSI.pt." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="d-flex">
        <div className="card m-1 p-1">
          <div className="card-body">
            <h5 className="card-title">Pesquisar documentos</h5>
            <h6 className="card-subtitle mb-2 text-muted"></h6>
            <div className="card-text"></div>
            <Link href="/pesquisa">Entrar</Link>
          </div>
        </div>
        <div className="card m-1 p-1">
          <div className="card-body">
            <h5 className="card-title">Navegar índices</h5>
            <h6 className="card-subtitle mb-2 text-muted"></h6>
            <div className="card-text"></div>
            <Link href="/indices">Entrar</Link>
          </div>
        </div>
        <div className="card m-1 p-1 text-muted">
          <div className="card-body">
            <h5 className="card-title">Explorar Dashboard</h5>
            <h6 className="card-subtitle mb-2 text-muted"></h6>
            <div className="card-text"></div>
            <Link href="/estatisticas">Entrar</Link>
          </div>
        </div>
      </div>
      
    </GenericPage>
  )
}
