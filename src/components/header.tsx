import Image from "next/image";
import Link from "next/link";
import ModalSobre from "./sobre";
import { useParams, usePathname, useSearchParams } from "next/navigation"
import logoname from '../../public/images/PT-logoLogo-STJ.png'
import { useAuth } from "@/contexts/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

const NAVEGACAO = ["Pesquisa", "Índices", /* "Dashboard"*/]

export function AdminHeader() {
    const router = useRouter();
    const user = useAuth();
    const [userIsLoggedIn, setUserIsLoggedIn] = useState(true);
    const Beat = useMemo(() => {
        if( !userIsLoggedIn ) return <i className="bi bi-circle text-danger"></i>
        return <i className="bi bi-circle-fill text-success"></i>
    }, [user, userIsLoggedIn])

    const checkLogin = useCallback((abortController?: AbortController) => {
        fetch(router.basePath + "/api/user", { signal: abortController?.signal })
            .then(r => r.json())
            .then(r => {
                if (r.name && r.name === user?.name) {
                    setUserIsLoggedIn(true)
                }
                else {
                    setUserIsLoggedIn(false)
                }
            }).catch(_e => setUserIsLoggedIn(false))
    }, [router.basePath, user])

    useEffect(() => {
        const abortController = new AbortController();
        const int = setInterval(() => {
            if( !document.hasFocus() ) return;
            checkLogin(abortController);
        }, 60000)
        return () => {
            abortController.abort()
            clearInterval(int)
        }
    }, [router.basePath, user])

    useEffect(() => {
        if( !userIsLoggedIn ){
            alert("A sessão expirou. Por favor faça login novamente.")
            window.open(window.location.origin + router.basePath + "/user/login?redirect=/close", "_blank", 'location=yes,height=570,width=520,scrollbars=no,status=no')?.focus()
        }
    }, [userIsLoggedIn])

    useEffect(() => {
        const abortController = new AbortController();
        const focusEventHandler = () => {
            checkLogin(abortController)
        }
        window.addEventListener("focus", focusEventHandler)
        return () => {
            abortController.abort()
            window.removeEventListener("focus", focusEventHandler)
        }
    }, [router.basePath, user])
    return <>
        <header className="mb-1 py-2 align-items-center d-flex flex-wrap border-bottom">
            <Link href="/admin" className="align-items-center d-flex flex-wrap text-decoration-none nav-link">
                <Image
                    src={logoname}
                    alt="Logótipo STJ"
                    height={70}
                    width={180}></Image>
                <div className="ps-2 d-flex flex-column align-items-center">
                    <h5 className="m-0 fancy-font">Jurisprudência - Admin</h5>
                </div>
            </Link>
            <div className="m-0 mt-auto text-dark">
                <p className="m-0">Utilizador: {user?.name} {Beat}</p>
            </div>
            <div className="flex-fill d-none d-lg-block"></div>
            <nav>
                <ul className="container d-flex nav align-items-center justify-content-evenly flex-wrap">
                    <li className="nav-link py-1 px-2 mx-1">
                        <Link href={`/`} className="border-0 nav-link fs-6 bg-transparent">Jurisprudência</Link>
                    </li>
                    <li className="nav-link py-1 px-2 mx-1">
                        <Link href={`/user`} className="border-0 nav-link fs-6 bg-transparent">Utilizador</Link>
                    </li>
                </ul>
            </nav>
        </header>
    </>
}

export default function Header(props: { keys_to_remove: string[] }) {
    const pathname = usePathname();
    const authed = useAuth();
    const querystring_from_next = useSearchParams(); // needs to remove path params
    const new_query_string = new URLSearchParams();
    for (let key of querystring_from_next.keys()) {
        if (!props.keys_to_remove.includes(key)) {
            new_query_string.delete(key)
            for (let val of querystring_from_next.getAll(key)) {
                new_query_string.append(key, val);
            }
        }
    }


    return <>
        <header className="mb-1 py-2 align-items-center d-flex flex-wrap border-bottom">
            <Link href="/" className="align-items-center d-flex flex-wrap text-decoration-none nav-link">
                <Image
                    src={logoname}
                    alt="Logótipo STJ"
                    height={70}
                    width={180}></Image>
                <div className="ps-2 d-flex flex-column align-items-center">
                    <h5 className="m-0 fancy-font">Jurisprudência</h5>
                </div>
            </Link>
            <div className="flex-fill d-none d-lg-block"></div>
            <nav>
                <ul className="container d-flex nav align-items-center justify-content-evenly flex-wrap">
                    {authed && <><li className="nav-link py-1 px-2 mx-1">
                        <Link href="/editar/simples/criar"
                            className={`${pathname.startsWith("/editar/avancado/criar") ? "active" : ""} border-0 nav-link fs-6 bg-transparent`}
                        >Criar Acórdão</Link>
                    </li>
                        <li className="nav-link py-1 px-2 mx-1">
                            <Link href="/user"
                                className={`border-0 nav-link fs-6 bg-transparent`}>Utilizador</Link>
                        </li>
                        <li>|</li></>}
                    {NAVEGACAO.map((name, i) => <li key={i} className="nav-link py-1 px-2 mx-1">
                        <Link
                            href={`/${name.normalize("NFKD").replace(/[^\w]/g, "").toLocaleLowerCase()}?${new_query_string.toString()}`}
                            className={`${pathname.startsWith(`/${name.normalize("NFKD").replace(/[^\w]/g, "").toLocaleLowerCase()}`) ? "active" : ""} border-0 nav-link fs-6 bg-transparent`}>
                            {name}</Link>
                    </li>)}
                    <li>|</li>
                    <li className="nav-link py-1 px-2 mx-1">
                        <Link href={`#`} className="border-0 nav-link fs-6 bg-transparent" role="button" data-bs-toggle="modal" data-bs-target="#modal-about">Sobre</Link>
                    </li>
                </ul>
            </nav>
        </header>
        <ModalSobre />
    </>
}