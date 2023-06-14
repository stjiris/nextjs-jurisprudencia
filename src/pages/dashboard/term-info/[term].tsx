import { DashboardGenericPage } from "@/components/genericPageStructure";
import { getTerm } from "@/core/term-info";
import { withAuthentication } from "@/core/user/authenticate";
import { Result } from "@elastic/elasticsearch/lib/api/types";
import { GetServerSidePropsContext } from "next";

import dynamic from 'next/dynamic';
import Link from "next/link";
import { NextRouter, useRouter } from "next/router";
import { ReactNode, useRef, useState } from "react";
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface TermsInfoPageProps {
    term: string,
    content: string
}

const getQueryTerm = (ctx: GetServerSidePropsContext) => Array.isArray(ctx.query.term) ? ctx.query.term[0] : ctx.query.term || ""

export const getServerSideProps = withAuthentication<TermsInfoPageProps>(async ctx => {
    let term = getQueryTerm(ctx);
    let content = await getTerm(term) || "";
    
    
    return ({props: {term, content}})
    
}, ctx => `/dashboard/term-info/${encodeURIComponent(getQueryTerm(ctx))}`)


async function save(router: NextRouter, term: string, content: string) {
    let r = await fetch(`${router.basePath}/api/term-info/${encodeURIComponent(term)}`, {
        body: content,
        method: "put"
    })
    return await r.json() as string
}

async function del(router: NextRouter, term: string) {
    let r = await fetch(`${router.basePath}/api/term-info/${encodeURIComponent(term)}`, {
        method: "delete"
    })
    return await r.json() as string
}

export default function TermsInfoPage({term, content: srcContent}: TermsInfoPageProps){
    let router = useRouter();
    let [content, setContent] = useState<string>(srcContent);
    let [requesting, setRequesting] = useState<boolean>(false)

    let doDelete = async () => {
        if( requesting ) return;
        setRequesting(true)
        let r = await del(router, term);
        setContent(r)
        setRequesting(false)
    }

    let doSave = async () => {
        if(requesting) return;
        setRequesting(true)
        let r = await save(router, term, content);
        setContent(r)
        setRequesting(false)
    }


    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <div className="card-title d-flex align-items-baseline">
                            <h4 className="flex-grow-1">Editar nota de "{term}"</h4>
                            <Link href=".">Voltar à lista de campos</Link>
                        </div>
                        <ReactQuill theme="snow" value={content} onChange={(evt) => setContent(evt)} readOnly={requesting}/>
                    </div>
                    <div className="card-footer d-flex">
                        <button className="btn btn-danger mx-1" onClick={doDelete} disabled={requesting}>Eliminar</button>
                        <div className="flex-grow-1"></div>
                        <Link href={requesting ? "" : "."} className={`btn btn-warning mx-1 ${requesting ? "disabled" : ""}`} >Cancelar</Link>
                        <button className="btn btn-primary mx-1" onClick={doSave} disabled={requesting}>Guardar</button>
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}
