import { DashboardGenericPage } from "@/components/genericPageStructure";
import { withAuthentication } from "@/core/user/authenticate";
import { DatalistObj } from "@/types/search";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";



export const getServerSideProps = withAuthentication<{}>(async () => ({props: {}}))

export default function TermsInfoIndexPage(){
    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <h4>Selecione um dos termos para ver ou editar a sua nota</h4>
                        <ListTerms />
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}

function ListTerms(){
    let router = useRouter();
    let [terms, setTerms] = useState<string[]>([])
    useEffect(() => {
        let controller = new AbortController();
        fetch(`${router.basePath}/api/term-info`).then( r => r.json()).then(setTerms)
        return () => {
            controller.abort()
        }
    },[router.basePath])

    return <ul>
        <For each={terms} doit={(t, i) => <li key={i}><Link href={`/dashboard/term-info/${encodeURIComponent(t)}`}>{t}</Link></li>}/>
    </ul>
}

function For<T>({each, doit}:{each: T[], doit: ((data: T, i: number, arr: T[]) => React.ReactNode)}){
    return <>{each.map(doit)}</>
}