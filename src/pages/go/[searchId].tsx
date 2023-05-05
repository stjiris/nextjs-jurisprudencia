import { GetServerSideProps } from "next"
import Link from "next/link"

export const getServerSideProps: GetServerSideProps = async () => {
    return { redirect: {destination: "/pesquisa"}, props: {url: ""}}
}

export default function GoToSearch({url}: {url: string}){
    return <>Se não tiver sido redirecionado para a página de pesquisa clique <Link href={url}>aqui</Link></>

}