import { ImportDeclaration, ImportSpecifier, Identifier, FunctionDeclaration, VariableDeclaration } from "estree";
import { Context, getAllOccurrencesInScope } from "js-slang";
import { DeclarationKind, getProgramNames, NameDeclaration } from "js-slang/dist/name-extractor";
import { looseParse, parseWithComments } from "js-slang/dist/parser/utils";
import { Node } from "js-slang/dist/types";
import { CompletionItem, CompletionItemKind, DocumentSymbol, Position, Range, TextEdit, WorkspaceEdit } from "vscode-languageserver";
import { ModuleImportRanges, DECLARATIONS, ImportedNameRanges, AUTOCOMPLETE_TYPES, CompletionItemData, ProgramSymbols, FunctionSymbol } from "./types";
import { applyFunctionOnNode, sourceLocToRange, findLastRange, FunctionNodeToSymbol, ImportNodeToSymbol, mapDeclarationKindToSymbolKind, VariableNodeToSymbol, VsPosInSourceLoc } from "./utils";
import { autocomplete_labels, module_autocomplete } from "./utils";
import { AST } from "./ast";

export async function getCompletionItems(
    text: string,
    pos: Position,
    context: Context
): Promise<CompletionItem[]> {
    const [program, comments] = parseWithComments(text);

    // This implementation in js-slang only gets the program names thats in the scope of the cursor location
    // However, one issue is that any imported names dont contain information of which module they are from
    // along with other info like function parameters. So we remove the imported names and they are added back
    // when we concat the module docs, and change their item.data.type to SYMBOL
    const [names, _success] = await getProgramNames(program, comments, { line: pos.line + 1, column: pos.character });


    const labels: CompletionItem[] = []

    // Get the imported names
    const imported_names: {
        [module_name: string]: Map<string, Range>
    } = {};
    (await applyFunctionOnNode<ModuleImportRanges>(program, {
        type: DECLARATIONS.IMPORT, callback: (node: Node): ModuleImportRanges[] => {
            node = node as ImportDeclaration;

            return [{
                type: "import",
                module_name: node.source.value as string,
                imports: node.specifiers.map((specifier): ImportedNameRanges => ({
                    name: ((specifier as ImportSpecifier).imported as Identifier).name,
                    range: sourceLocToRange(specifier.loc!)
                }))
            }];
        }
    }, {
        // We also parse through the ast for function and variable declarations,
        // probably a better way to do this but it works for now
        type: DECLARATIONS.FUNCTION, callback: (node: Node) => {
            node = node as FunctionDeclaration;
            labels.push({
                label: node.id!.name,
                labelDetails: { detail: " (func)" },
                kind: CompletionItemKind.Function,
                data: { type: AUTOCOMPLETE_TYPES.SYMBOL, parameters: node.params.map(param => (param as Identifier).name)},
                sortText: '' + AUTOCOMPLETE_TYPES.SYMBOL
            });

            return [];
        }
    }, {
        type: DECLARATIONS.VARIABLE, callback: (node: Node) => {
            node = node as VariableDeclaration;

            node.declarations.forEach(declaration => {
                if (VsPosInSourceLoc(pos, node.loc!)) {
                    labels.push({
                        label: (declaration.id as Identifier).name,
                        labelDetails: {detail: ` (${node.kind})`},
                        kind: node.kind === 'var' || node.kind === 'let' ? CompletionItemKind.Variable : CompletionItemKind.Constant,
                        data: { type: AUTOCOMPLETE_TYPES.SYMBOL },
                        sortText: '' + AUTOCOMPLETE_TYPES.SYMBOL
                    })
                }
            });
            return []
        }
    })).forEach(el => {
        if (el.type === "import") {
            if (!imported_names[el.module_name]) imported_names[el.module_name] = new Map();

            el.imports.forEach(name => {
                imported_names[el.module_name].set(name.name, name.range)
            });
        }
    });

    return autocomplete_labels[context.chapter - 1]
        .concat(labels)
        .concat(module_autocomplete.map((item: CompletionItem): CompletionItem => {
            if (imported_names[item.data.module_name]) {
                if (imported_names[item.data.module_name].has(item.label)) {
                    return {
                        ...item,
                        detail: `Imported from ${item.data.module_name}`,
                        data: { type: AUTOCOMPLETE_TYPES.SYMBOL, ...item.data }
                    };
                }
                else {
                    // Not sure if the ast preserves the order that names are imported
                    let last_imported_range: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
                    imported_names[item.data.module_name].forEach(range => {
                        last_imported_range = findLastRange(last_imported_range, range);
                    });
                    return {
                        ...item,
                        additionalTextEdits: [
                            TextEdit.insert(last_imported_range.end, `, ${item.label}`)
                        ]
                    };
                };
            }
            else return {
                ...item,
                additionalTextEdits: [
                    TextEdit.insert({ line: 0, character: 0 }, `import { ${item.label} } from "${item.data.module_name};"\n`)
                ]
            };
        }));
}