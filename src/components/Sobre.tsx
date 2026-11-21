import Link from "next/link";
import banner from '../../public/images/stjiris-banner.png'
import Image from "next/image";
import { useFetch } from "./useFetch";
import { BadgeFromState } from "./BadgeFromState";
import { JurisprudenciaDocumentStateValue } from "@stjiris/jurisprudencia-document";

export default function Sobre() {
    return <div className="modal fade" id="modal-about" tabIndex={-1} role="dialog" aria-labelledby="modal-label" aria-hidden="true">
        <div className="modal-dialog">
            <div className="modal-content">
                <div className="modal-header">
                    <div>
                        <h5 className="modal-title" id="modal-label">Sobre a Jurisprudência</h5>
                        <p className="m-0">Permite explorar, pesquisar e filtrar os acórdãos publicados pelo Supremo Tribunal de Justiça.</p>
                        <ShowVersion />
                    </div>
                </div>
                <div className="modal-body">
                    <h6>Pesquisa</h6>
                    <p>
                        O campo &quot;Texto Livre&quot; permite ao utilizador pesquisar por um ou mais termos em todos os campos de cada acórdão.
                        Quando algum dos termos é encontrado no sumário ou no texto a sua posição é destacada.
                        O resultado da pesquisa é a união dos resultados de cada termo, sendo suportados alguns operadores de pesquisa<sup>1</sup>, nomeadamente:
                    </p>
                    <ul>
                        <li><code>-<i>termo</i></code> - pesquisa por resultados sem o <code><i>termo</i></code>.</li>
                        <li><code>&quot;<i>termo(s)</i>&quot;</code> - pesquisa exata pelo(s) <code><i>termo(s)</i></code>.</li>
                        <li><code><i>termo</i>*</code> - pesquisa usando o prefixo <code><i>termo</i></code>.</li>
                        <li><code>+<i>termo</i></code> - força os resultados já obtidos a conter o <code><i>termo</i></code>.</li>
                        <li><code>+-<i>termo</i></code> - força os resultados já obtidos a não conter o <code><i>termo</i></code>.</li>
                    </ul>
                    <h6>Filtros</h6>
                    <p>
                        É possível filtrar por Data, dando um ano de início, um ano de fim ou ambos.
                    </p>
                    <p>
                        Por defeito os filtros usam uma pesquisa parcial. Para pesquisar exatamente um valor deve-se o valor entre aspas.
                        Por exemplo, filtrar pelo descritor <Link href="/pesquisa/?Descritores=Recurso" target="_blank">Recurso</Link> incluí respostas com descritores que contêm a palavra Recurso. O que não acontece procurando <Link href="/pesquisa?Descritores=%22Recurso%22" target="_blank">&quot;Recurso&quot;</Link>.
                    </p>
                    <h6>Ordenação</h6>
                    <p>
                        Os resultados podem ser ordenados por data ou pela relevância que têm para a pesquisa feita.
                    </p>
                </div>
                <div className="modal-footer">
                    <div className="flex-grow-1">
                        <div>
                            <Image
                                src={banner}
                                alt="Banner cofinanciamento, STJ e INESC-ID" className="w-100 h-auto"></Image>
                            <hr />
                        </div>
                        <div><small><sup>1</sup> Ver todas os operadores de pesquisa suportados na <a href="https://www.elastic.co/guide/en/elasticsearch/reference/8.4/query-dsl-simple-query-string-query.html#simple-query-string-syntax" target="_blank">documentação</a> do ElasticSearch.</small></div>
                        <div><small>Documentos Google Drive:&nbsp;
                            <a href="https://docs.google.com/document/d/1WSDh_b0Y4XtMVoMuDiaVfWmFsW5ktbTaUI2CGHMdcys/edit?usp=sharing" target="_blank"> Notas Jurisprudência</a>
                            &nbsp;
                            <a href="https://docs.google.com/document/d/1jz8CVWifPHAZS1BBm6Vi3YWVb-xS5vJk8UbblsWRz-A/edit?usp=sharing" target="_blank"> Notas Pesquisa</a>
                        </small></div>
                        <div><small><Link href="/admin" target="_blank">Admin</Link></small></div>
                        <div><small><Link href="/changelog"><i className="bi bi-clock-history me-1"></i>Registo de Alterações (Changelog)</Link></small></div>
                        <div><small><Link href="https://www.github.com/stjiris/jurisprudencia" target="_blank"><i className="bi bi-github"></i> @stjiris/jurisprudencia</Link></small></div>
                    </div>
                    <Link href="/changelog" className="btn btn-outline-primary me-2">
                        <i className="bi bi-journal-text me-1"></i>Registo de Alterações
                    </Link>
                    <button className="btn btn-secondary" type="button" data-bs-dismiss="modal">Fechar</button>
                </div>
            </div>
        </div>
    </div>
}

function ShowVersion() {
    let info = useFetch<{ version: string, mostRecent?: string, publicStates?: JurisprudenciaDocumentStateValue[] }>("/api/index-info", []);
    const appVersion = info?.version || "0.4.0";

    return <div className="m-0 mt-1">
        <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
            <small className="fw-semibold">Versão: {appVersion}</small>
            <Link
                href="/changelog"
                className="badge bg-primary text-white text-decoration-none shadow-sm"
                title="Consultar histórico de alterações e notas de versão"
            >
                <i className="bi bi-clock-history me-1"></i>Registo de alterações
            </Link>
            <a
                href="/CHANGELOG.md"
                target="_blank"
                rel="noopener noreferrer"
                className="badge bg-light text-secondary border text-decoration-none shadow-sm"
                title="Aceder diretamente ao ficheiro CHANGELOG.md bruto"
            >
                <i className="bi bi-filetype-md me-1"></i>.md
            </a>
        </div>
        {info?.mostRecent && <small className="text-muted d-block">Documento mais recente: {info?.mostRecent}</small>}
        {info?.publicStates && <small className="text-muted d-block">Estados visíveis: {info?.publicStates.map((s, i) => <span key={i}><BadgeFromState state={s} /> </span>)}</small>}
    </div>
}