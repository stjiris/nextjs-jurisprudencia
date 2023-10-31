import Script from "next/script";
import React, { useContext, useEffect } from "react";
import Header, { AdminHeader } from "./header";
import SearchForm from "./searchForm";
import { KeysProvider } from "@/contexts/keys";
import { AuthProvider } from "@/contexts/auth";

const BootScript = () => <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossOrigin="anonymous"/>

export default function GenericPage(props: {keys_to_remove?: string[], children: React.ReactNode}){
    return <KeysProvider>
        <AuthProvider>
            <Header keys_to_remove={props.keys_to_remove || []}></Header>
            <main className='container-fluid'>
                {props.children}
            </main>
            <BootScript/>
        </AuthProvider>
    </KeysProvider>
}

export function GenericPageWithForm(props: {keys_to_remove?: string[], count: number, children: React.ReactNode, filtersUsed: Record<string, string[]>, minAno: number, maxAno: number, escapeChildren?: React.ReactNode}){
    return <KeysProvider>
        <AuthProvider>
            <Header keys_to_remove={props.keys_to_remove || []}></Header>
            <main className='container-fluid'>
                <div className="row">
                    <div className="col-12 col-sm-4 col-md-3 col-xl-2 d-print-none infofilters">
                        <SearchForm count={props.count} filtersUsed={props.filtersUsed} minAno={props.minAno} maxAno={props.maxAno}></SearchForm>
                    </div>
                    <div className="col-12 col-sm-8 col-md-9 col-xl-10" id="main">
                        {props.children}
                    </div>
                </div>
            </main>
            {props.escapeChildren}
            <BootScript/>
        </AuthProvider>
    </KeysProvider>
}

export function DashboardGenericPage(props: {children: React.ReactNode}){
    return <KeysProvider>
        <AuthProvider>
            <AdminHeader/>
            <main className='container-fluid'>
                {props.children}
            </main>
            <BootScript/>
        </AuthProvider>
    </KeysProvider>
}