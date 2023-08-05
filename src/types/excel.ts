export enum FileState {
    no_file,
    dot_file,
    file
}

export type ExcelFile = {
    id: string,
    imported: FileState,
    exported_all: FileState,
    exported_agg: FileState,
    result: FileState
}

export type ExcelState = {
    import: null | number // null not busy // number progress
    export: null | number
}