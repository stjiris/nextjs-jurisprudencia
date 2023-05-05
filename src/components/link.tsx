import Link from "next/link";

export default function TargetBlankLink(props: any){
    return <Link target="blank" {...props}>{...props.children}<sup><i className="bi bi-box-arrow-up-right"></i></sup></Link>
}