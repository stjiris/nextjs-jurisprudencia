import Image from "next/image";
import Link from "next/link";
import ModalSobre from "./Sobre";
import { usePathname, useSearchParams } from "next/navigation"
import logoname from '../../public/images/PT-logoLogo-STJ.png'
import { useAuth } from "@/contexts/auth";

interface NavItem {
    label: string;
    getHref: (qs: string) => string;
    isActive: (pathname: string) => boolean;
    openInNewTab?: boolean;
}

const NAVEGACAO: NavItem[] = [
    {
        label: "Pesquisa",
        getHref: (qs) => `/pesquisa?${qs}`,
        isActive: (p) => p.startsWith("/pesquisa"),
    },
    {
        label: "Índices",
        getHref: (qs) => `/indices?${qs}`,
        isActive: (p) => p.startsWith("/indices"),
    },
    {
        label: "Ver como Boletim",
        getHref: (qs) => `/api/boletim/pesquisa/html?${qs}`,
        isActive: () => false,
        openInNewTab: true,
    },
    {
        label: "Boletim de Jurisprudência",
        getHref: (qs) => `/boletim?${qs}`,
        isActive: (p) => p.startsWith("/boletim"),
    },
];

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
                        <Link href="/pesquisa?STATE=importação"
                            className="border-0 nav-link fs-6 bg-transparent">Por Anonimizar</Link>
                    </li>
                        <li className="nav-link py-1 px-2 mx-1">
                            <Link href="/pesquisa?STATE=preparação"
                                className="border-0 nav-link fs-6 bg-transparent">Por Publicar</Link>
                        </li>
                        <li className="nav-link py-1 px-2 mx-1">
                            <Link href="/user"
                                className={`border-0 nav-link fs-6 bg-transparent`}>Utilizador</Link>
                        </li>
                        <li>|</li></>}
                    {NAVEGACAO.map((item, i) => (
                        <li key={i} className="nav-link py-1 px-2 mx-1">
                            <Link
                                href={item.getHref(new_query_string.toString())}
                                target={item.openInNewTab ? "_blank" : undefined}
                                rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                                className={`${item.isActive(pathname) ? "active" : ""} border-0 nav-link fs-6 bg-transparent`}
                            >
                                {item.label}
                            </Link>
                        </li>
                    ))}
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