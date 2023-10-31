import Image from "next/image";
import Link from "next/link";
import ModalSobre from "./sobre";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import logoname from '../../public/images/PT-logoLogo-STJ.png'
import { useAuth } from "@/contexts/auth";

const NAVEGACAO = ["Pesquisa", "Índices", /* "Dashboard"*/]

export function AdminHeader(){
    const user = useAuth();
    return <>
        <header className="mb-1 py-2 align-items-center d-flex flex-wrap border-bottom">
            <Link href="/admin" className="align-items-center d-flex flex-wrap text-decoration-none nav-link">
                <Image 
                    src={logoname}
                    alt="Logótipo STJ"
                    height={70}
                    width={180}></Image>
                <div className="ps-2 d-flex flex-column align-items-center">
                    <div className="m-0 d-flex align-items-baseline">
                        <h5 className="m-0 fancy-font">Jurisprudência</h5>
                        {user && <span className="px-1">Bem vindo, {user?.name}</span>}
                    </div>
                </div>
            </Link>
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

export default function Header(props: {keys_to_remove: string[]}){
    const user = useAuth();
    const pathname = usePathname();
    const querystring_from_next = useSearchParams(); // needs to remove path params
    const new_query_string = new URLSearchParams();
    for(let key of querystring_from_next.keys()){
        if( !props.keys_to_remove.includes(key)){
            new_query_string.delete(key)
            for( let val of querystring_from_next.getAll(key)){
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
                    <div className="m-0 d-flex align-items-baseline">
                        <h5 className="m-0 fancy-font">Jurisprudência</h5>
                        {user && <span className="px-1">Bem vindo, {user?.name}</span>}
                    </div>
                </div>
            </Link>
            <div className="flex-fill d-none d-lg-block"></div>
            <nav>
                <ul className="container d-flex nav align-items-center justify-content-evenly flex-wrap">
                    {NAVEGACAO.map((name,i) => <li key={i} className="nav-link py-1 px-2 mx-1">
                        <Link
                            href={`/${name.normalize("NFKD").replace(/[^\w]/g,"").toLocaleLowerCase()}?${new_query_string.toString()}`}
                            className={`${pathname.startsWith(`/${name.normalize("NFKD").replace(/[^\w]/g,"").toLocaleLowerCase()}`) ? "active": ""} border-0 nav-link fs-6 bg-transparent`}>
                                {name}</Link>
                    </li>)}
                    <li>|</li>
                    <li className="nav-link py-1 px-2 mx-1">
                        <Link href={`#`} className="border-0 nav-link fs-6 bg-transparent" role="button" data-bs-toggle="modal" data-bs-target="#modal-about">Sobre</Link>
                    </li>
                </ul>
            </nav>
        </header>
        <ModalSobre/>
    </>
}