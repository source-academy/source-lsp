import { Chapter, Context, Node } from "js-slang/dist/types";
import { findDeclarationNode, findIdentifierNode } from "js-slang/dist/finder";
import { Comment } from 'acorn';
import { Identifier, ImportSpecifier, Program, SourceLocation } from 'estree';
import { parseWithComments } from "js-slang/dist/parser/utils";
import { DECLARATIONS, DeclarationSymbol } from "./types";
import { getNodeChildren, mapDeclarationKindToSymbolKind, sourceLocToRange } from "./utils";
import { DocumentHighlight, DocumentSymbol, Position, TextEdit, WorkspaceEdit } from "vscode-languageserver";
import { DeclarationKind } from "js-slang/dist/name-extractor";
import { getAllOccurrencesInScopeHelper } from "js-slang/dist/scope-refactoring";

export class AST {
    private ast: Node;
    private comments: Comment[];
    private context: Context;
    readonly declarations: Map<string, Array<DeclarationSymbol>> = new Map();
    private uri: string;

    constructor(text: string, context: Context, uri: string) {
        [this.ast, this.comments] = parseWithComments(text);
        this.context = context;
        this.uri = uri;


        const queue: Node[] = [this.ast];
        while(queue.length > 0) {
            const parent = queue.shift()!;

            // We iterate over the children here to maintain the parent pointer to store the scope.
            getNodeChildren(parent).forEach((child: Node) => {
                if (child.type === DECLARATIONS.IMPORT) {
                    child.specifiers.forEach(specifier => {
                        const name = ((specifier as ImportSpecifier).imported as Identifier).name;
                        this.addDeclaration(name, {
                            name: name,
                            scope: parent.loc!,
                            meta: "const",
                            declarationKind: DeclarationKind.KIND_IMPORT,
                            range: sourceLocToRange(child.loc!),
                            selectionRange: sourceLocToRange(specifier.loc!)
                        })
                    })
                }

                else if (child.type === DECLARATIONS.VARIABLE) {
                    child.declarations.forEach(declaration => {
                        const name = (declaration.id as Identifier).name;
                        this.addDeclaration(name, {
                            name: name,
                            scope: parent.loc!,
                            meta: child.kind === "var" || child.kind === "let" ? "let" : "const",
                            declarationKind: child.kind === "var" || child.kind === "let" ? DeclarationKind.KIND_LET : DeclarationKind.KIND_CONST,
                            range: sourceLocToRange(declaration.loc!),
                            selectionRange: sourceLocToRange(declaration.id.loc!)
                        });
                    })
                }

                else if (child.type === DECLARATIONS.FUNCTION) {
                    const name = child.id!.name;
                    this.addDeclaration(name, {
                        name: name,
                        scope: parent.loc!,
                        meta: "func",
                        declarationKind: DeclarationKind.KIND_FUNCTION,
                        range: sourceLocToRange(child.loc!),
                        selectionRange: sourceLocToRange(child.id!.loc!)
                    });

                    child.params.forEach(param => {
                        const name = (param as Identifier).name;
                        this.addDeclaration(name, {
                            name: name,
                            scope: child.body.loc!,
                            meta: context.chapter == Chapter.SOURCE_1 || context.chapter === Chapter.SOURCE_2 ? "const" : "let",
                            declarationKind: DeclarationKind.KIND_PARAM,
                            range: sourceLocToRange(param.loc!),
                            selectionRange: sourceLocToRange(param.loc!)
                        });
                    })

                    queue.push(child.body);
                }

                else {
                    queue.push(child);
                }
            })
        }
    }

    private addDeclaration(name: string, declaration: DeclarationSymbol): void {
        if(!this.declarations.has(name)) this.declarations.set(name, []);
        this.declarations.get(name)!.push(declaration);
    }

    public findDeclaration(pos: Position): SourceLocation | null | undefined {
        const identifier = findIdentifierNode(this.ast, this.context, {line: pos.line+1, column: pos.character});
        if (!identifier) return null;
        
        const declaration = findDeclarationNode(this.ast, identifier);
        if (!declaration)  return null;

        return declaration.loc;
    }

    public getOccurences(pos: Position): DocumentHighlight[] {
        const identifier = findIdentifierNode(this.ast, this.context, {line: pos.line+1, column: pos.character});
        if (!identifier) return [];
        
        const declaration = findDeclarationNode(this.ast, identifier);
        if (!declaration)  return [];

        return getAllOccurrencesInScopeHelper(declaration.loc!, this.ast as Program, identifier.name).map(loc => ({range: sourceLocToRange(loc)}));
    }

    public getDocumentSymbols(): DocumentSymbol[] {
        let ret: DocumentSymbol[] = []
        this.declarations.forEach((value, key) => {
            ret = ret.concat(value.map((declaration: DeclarationSymbol): DocumentSymbol => ({
                name: declaration.name,
                kind: mapDeclarationKindToSymbolKind(declaration.declarationKind, this.context),
                range: declaration.range,
                selectionRange: declaration.selectionRange
            })))
        })

        return ret;
    }

    public renameSymbol(pos: Position, newName: string): WorkspaceEdit | null {
        const occurences = this.getOccurences(pos);
        if (occurences.length === 0) return null;

        return {
            changes: {
                [this.uri]: occurences.map(loc => TextEdit.replace(loc.range, newName))
            }
        };
    }
}