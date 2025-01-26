import { DeclarationKind } from "js-slang/dist/name-extractor";
import { Range } from "vscode-languageserver/node";

export interface ProgramSymbols {
    name: string,
    kind: DeclarationKind,
    range: Range,
    selectionRange: Range,
}