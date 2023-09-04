import { modifySearchParams, SelectNavigate } from "@/components/select-navigate";

export function SelectTerm(props: { term: string; }) {
    return <SelectNavigate name="group" defaultValue={props.term} valueToHref={(v, params) => `?${modifySearchParams(params, "term", v).toString()}`}>
        <Terms/>
    </SelectNavigate>;
}

export function Terms(){
    return <>
        <option value="Jurisprudência" label="Jurisprudência" />
        <option value="Área" label="Área" />
        <option value="Secção" label="Secção" />
        <option value="Relator Nome Profissional" label="Relator" />
        <option value="Meio Processual" label="Meio Processual" />
        <option value="Decisão" label="Decisão" />
        <option value="Votação" label="Votação" />
        <option value="Descritores" label="Descritores" />
        <option value="Tribunal de Recurso" label="Tribunal de Recurso" />
        <option value="Tribunal de Recurso - Processo" label="Tribunal de Recurso - Processo" />
        <option value="Área Temática" label="Área Temática" />
        <option value="Jurisprudência Estrangeira" label="Jurisprudência Estrangeira" />
        <option value="Jurisprudência Internacional" label="Jurisprudência Internacional" />
        <option value="Doutrina" label="Doutrina" />
        <option value="Jurisprudência Nacional" label="Jurisprudência Nacional" />
        <option value="Legislação Comunitária" label="Legislação Comunitária" />
        <option value="Legislação Estrangeira" label="Legislação Estrangeira" />
        <option value="Legislação Nacional" label="Legislação Nacional" />
        <option value="Referências Internacionais" label="Referências Internacionais" />
        <option value="Referência de publicação" label="Referência de publicação" />
        <option value="Indicações Eventuais" label="Indicações Eventuais" />
    </>
}