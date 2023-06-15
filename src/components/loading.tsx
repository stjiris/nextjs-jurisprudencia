import { AriaRole, DetailedHTMLProps, HTMLAttributes } from "react"

export function Loading(){
    return <div className="alert alert-info" role="alert">
        <h4 className="alert-heading align-items-baseline"><SmallSpinner/>&nbsp;A carregar resultados...</h4>
    </div>
}

export function SmallSpinner({className, ...props}: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>,HTMLDivElement>){
    let finalProps = {...props, className: `spinner-border spinner-border-sm ${className}`, role: "status"}
    return <span {...finalProps}/>
}