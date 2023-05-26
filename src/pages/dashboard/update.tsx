import GenericPage, { DashboardGenericPage } from "@/components/genericPageStructure";
import { withAuthentication } from "@/core/user/authenticate";
import { GetServerSideProps } from "next";
import { useState } from "react"

export const getServerSideProps: GetServerSideProps<{}> = withAuthentication(async (ctx) => ({props: {}}), "/dashboard/update")

export default function UpdatePage(){
    let [id, setId] = useState<string>();



    return <DashboardGenericPage>
        <input type="text" name="iuec" required placeholder="ID, UUID, ECLI" onKeyDown={(evt => evt.key == "Enter" && setId(evt.currentTarget.value))} onBlur={(evt) => setId(evt.currentTarget.value)}/>
        Searching {id}
        <form method="post" id="update-form" action="./update">
            <fieldset>
                <legend>Metadados (ID: <input id="trueid" name="_id" readOnly title="Identificador Interno" defaultValue={id}/>)</legend>
                <table>
                    <tbody id="update-tbody-group"></tbody>
                </table>
            </fieldset>
            <fieldset>
                <legend>Confirmar Alterações</legend>
                <pre id="preview-changes"></pre>
                <input type="text" name="code" required placeholder="Código"/>
                <button type="submit" name="action" value="update">Atualizar</button>
            </fieldset>
        </form>
    </DashboardGenericPage>
}
/**

<script>
    let prevChanges = document.getElementById("preview-changes");
    let updateForm = document.getElementById("update-form");
    let searchForm = document.getElementById("search-form");
    let searchBtn = document.getElementById("search-btn");
    searchBtn.setAttribute("disabled","disabled")
    let fields = [];
    let arrayFields = {};
    fetch('./fields').then( r => r.json() ).then( fieldList => {fields = fieldList; searchBtn.removeAttribute("disabled")} );
    
    function showData(r){
        arrayFields = {}
        document.getElementById("trueid").value = r._id;
        let parent = document.getElementById("update-tbody-group");
        for( let fieldName of fields ){
            let row = parent.insertRow();
            let labelCell = row.insertCell();
            let lbl = document.createElement("label");
            lbl.htmlFor = fieldName;
            lbl.textContent = `${fieldName}:`
            labelCell.appendChild(lbl)
            let valueCell = row.insertCell();
            valueCell.style.verticalAlign = "baseline"
            let value = document.createElement("pre");
            value.style.border = "1px solid grey"
            value.textContent = Array.isArray(r._source[fieldName]) ? r._source[fieldName].join("\n") : r._source[fieldName];
            valueCell.appendChild(value)
            let inputCell = row.insertCell();
            let input = document.createElement("input");
            input.placeholder = r._source[fieldName]
            if( Array.isArray(r._source[fieldName])){
                arrayFields[fieldName] = true;
                input = document.createElement("textarea")
                input.placeholder = r._source[fieldName].join("\n")
                input.rows=10
                input.cols=80
            }
            input.style.width="100%"
            input.name=fieldName
            input.id=fieldName
            inputCell.appendChild(input)
        }
    }

    searchForm.addEventListener("submit", ev => {
        ev.preventDefault();
        if( searchBtn.hasAttribute("disabled") ) return;
        searchBtn.setAttribute("disabled","disabled")
        let fd = new FormData(searchForm);
        let params = new URLSearchParams(fd);
        fetch(`./search?${params.toString()}`).then( r => r.json()).then(showData).finally(_ => searchBtn.removeAttribute("disabled"))
    })
    updateForm.addEventListener("change", ev => {
        let fd = new FormData(updateForm);
        let doc = {}
        fd.forEach( (value, key) => {
            if( value != ""  && key != "code" && key != "_id" ){
                doc[key] = arrayFields[key] ? value.split("\n") : value
            }
        })
        prevChanges.textContent = JSON.stringify(doc, null, "  ")
    })

    updateForm.addEventListener("submit", ev => {
        ev.preventDefault();
        let fd = new FormData(updateForm);
        let doc = {}
        fd.forEach( (value, key) => {
            if( value != "" && key != "code" && key != "_id"){
                doc[key] = arrayFields[key] ? value.split("\n") : value
            }
        })
        fetch("./update", {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: fd.get("code"),
                id: fd.get("_id"),
                doc: doc
            })
        }).then( r => r.text() ).then( t => document.write(t) )
    })

/*fetch('./fields').then( r => r.json() ).then( fieldList => {
    let parent = document.getElementById("field-table");
    let columnSize = 6;
    let col = 0;
    for(let field of fieldList){
        let inp = document.createElement("input");
        inp.type="text"
        inp.name=field
        inp.placeholder=field
        parent.appendChild(inp)
    }
    checkAllState()
})
</script>*/