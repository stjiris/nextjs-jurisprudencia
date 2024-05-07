import { LoggerServerSideProps } from "@/core/logger-api"
import { getShearchParams } from "@/core/track-search"
import { GetServerSideProps } from "next"
import Link from "next/link"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    LoggerServerSideProps(ctx);
    let params = await getShearchParams(ctx.params?.searchId as string);

    return { redirect: {destination: params}, props: {url: params}}
}

export default function GoToSearch({url}: {url: string}){
    return <>Se não tiver sido redirecionado para a página de pesquisa clique <Link href={url}>aqui</Link></>

}