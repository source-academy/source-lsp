"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportNodeToSymbol = exports.FunctionNodeToSymbol = exports.VariableNodeToSymbol = void 0;
exports.getNodeChildren = getNodeChildren;
exports.getSubstrFromSouceLoc = getSubstrFromSouceLoc;
exports.sourceLocToRange = sourceLocToRange;
exports.mapDeclarationKindToSymbolKind = mapDeclarationKindToSymbolKind;
exports.mapMetaToCompletionItemKind = mapMetaToCompletionItemKind;
exports.applyFunctionOnNode = applyFunctionOnNode;
exports.findExistingImportLine = findExistingImportLine;
exports.findLastRange = findLastRange;
const types_1 = require("js-slang/dist/types");
const vscode_languageserver_1 = require("vscode-languageserver");
const name_extractor_1 = require("js-slang/dist/name-extractor");
const types_2 = require("./types");
function isNotNull(x) {
    // This function exists to appease the mighty typescript type checker
    return x !== null;
}
function isNotNullOrUndefined(x) {
    // This function also exists to appease the mighty typescript type checker
    return x !== undefined && isNotNull(x);
}
function getNodeChildren(node) {
    switch (node.type) {
        case 'Program':
            return node.body;
        case 'BlockStatement':
            return node.body;
        case 'WhileStatement':
            return [node.test, node.body];
        case 'ForStatement':
            return [node.init, node.test, node.update, node.body].filter(isNotNullOrUndefined);
        case 'ExpressionStatement':
            return [node.expression];
        case 'IfStatement':
            const children = [node.test, node.consequent];
            if (isNotNullOrUndefined(node.alternate)) {
                children.push(node.alternate);
            }
            return children;
        case 'ReturnStatement':
            return node.argument ? [node.argument] : [];
        case 'FunctionDeclaration':
            return [node.body];
        case 'VariableDeclaration':
            return node.declarations.flatMap(getNodeChildren);
        case 'VariableDeclarator':
            return node.init ? [node.init] : [];
        case 'ArrowFunctionExpression':
            return [node.body];
        case 'FunctionExpression':
            return [node.body];
        case 'UnaryExpression':
            return [node.argument];
        case 'BinaryExpression':
            return [node.left, node.right];
        case 'LogicalExpression':
            return [node.left, node.right];
        case 'ConditionalExpression':
            return [node.test, node.alternate, node.consequent];
        case 'CallExpression':
            return [...node.arguments, node.callee];
        // case 'Identifier':
        // case 'DebuggerStatement':
        // case 'BreakStatement':
        // case 'ContinueStatement':
        // case 'MemberPattern':
        case 'ArrayExpression':
            return node.elements.filter(isNotNull);
        case 'AssignmentExpression':
            return [node.left, node.right];
        case 'MemberExpression':
            return [node.object, node.property];
        case 'Property':
            return [node.key, node.value];
        case 'ObjectExpression':
            return [...node.properties];
        case 'NewExpression':
            return [...node.arguments, node.callee];
        default:
            return [];
    }
}
function getSubstrFromSouceLoc(text, loc) {
    return loc.start.line === loc.end.line ?
        text[loc.start.line - 1].substring(loc.start.column, loc.end.column)
        : [text[loc.start.line - 1].substring(loc.start.column), ...text.slice(loc.start.line, loc.end.line - 1), text[loc.end.line - 1].substring(0, loc.end.column)].join('\n');
}
function sourceLocToRange(loc) {
    return {
        start: {
            line: loc.start.line - 1,
            character: loc.start.column
        },
        end: {
            line: loc.end.line - 1,
            character: loc.end.column
        }
    };
}
function mapDeclarationKindToSymbolKind(kind, context) {
    switch (kind) {
        case name_extractor_1.DeclarationKind.KIND_IMPORT:
            return vscode_languageserver_1.SymbolKind.Namespace;
        case name_extractor_1.DeclarationKind.KIND_FUNCTION:
            return vscode_languageserver_1.SymbolKind.Function;
        case name_extractor_1.DeclarationKind.KIND_LET:
            return vscode_languageserver_1.SymbolKind.Variable;
        case name_extractor_1.DeclarationKind.KIND_PARAM:
            return context.chapter === types_1.Chapter.SOURCE_1 || context.chapter === types_1.Chapter.SOURCE_2 ? vscode_languageserver_1.SymbolKind.Constant : vscode_languageserver_1.SymbolKind.Variable;
        case name_extractor_1.DeclarationKind.KIND_CONST:
            return vscode_languageserver_1.SymbolKind.Constant;
        default:
            return vscode_languageserver_1.SymbolKind.Namespace;
    }
}
function mapMetaToCompletionItemKind(meta) {
    switch (meta) {
        case "const":
            return vscode_languageserver_1.CompletionItemKind.Constant;
        case "let":
            return vscode_languageserver_1.CompletionItemKind.Variable;
        case "import":
            return vscode_languageserver_1.CompletionItemKind.Module;
        default:
            return vscode_languageserver_1.CompletionItemKind.Text;
    }
}
// The getNames function in js-slang has some issues, firstly it only get the names within a given scope, and it doesnt return the location of the name
// This implementation doesn't care where the cursor is, and grabs the name of all variables and functions
// @param prog Root node of the program, generated using looseParse
// @param ...nodeCallbacks accepts a variable number of callback objects {type: string, callback: (node: Node) => T[]}
// The type is the string that identifies the type of node
// @returns Promise<T[]>
async function applyFunctionOnNode(prog, ...nodeCallbacks) {
    const queue = [prog];
    let symbols = [];
    while (queue.length > 0) {
        const node = queue.shift();
        nodeCallbacks.forEach(x => {
            if (node.type === x.type) {
                symbols = symbols.concat(x.callback(node));
            }
        });
        queue.push(...getNodeChildren(node));
    }
    return symbols;
}
function variableDeclarationToSymbol(node) {
    node = node;
    return node.declarations.map((declaration) => ({
        name: declaration.id.name,
        kind: node.kind === 'var' || node.kind === 'let' ? name_extractor_1.DeclarationKind.KIND_LET : name_extractor_1.DeclarationKind.KIND_CONST,
        range: sourceLocToRange(declaration.loc),
        selectionRange: sourceLocToRange(declaration.id.loc)
    }));
}
function functionDeclarationToSymbol(node) {
    node = node;
    const ret = node.params.map((param) => ({
        name: param.name,
        kind: name_extractor_1.DeclarationKind.KIND_PARAM,
        range: sourceLocToRange(param.loc),
        selectionRange: sourceLocToRange(param.loc)
    }));
    ret.push({
        name: node.id.name,
        kind: name_extractor_1.DeclarationKind.KIND_FUNCTION,
        range: sourceLocToRange(node.loc),
        selectionRange: sourceLocToRange(node.id.loc)
    });
    return ret;
}
function importDeclarationToSymbol(node) {
    node = node;
    return node.specifiers.map((specifier) => ({
        name: specifier.imported.name,
        kind: name_extractor_1.DeclarationKind.KIND_IMPORT,
        range: sourceLocToRange(node.loc),
        selectionRange: sourceLocToRange(specifier.loc)
    }));
}
exports.VariableNodeToSymbol = {
    type: types_2.DECLARATIONS.VARIABLE,
    callback: variableDeclarationToSymbol
};
exports.FunctionNodeToSymbol = {
    type: types_2.DECLARATIONS.FUNCTION,
    callback: functionDeclarationToSymbol
};
exports.ImportNodeToSymbol = {
    type: types_2.DECLARATIONS.IMPORT,
    callback: importDeclarationToSymbol
};
function findExistingImportLine(code, moduleName) {
    const importRegex = `import\\s*{\\s*([^}]*)\\s*}\\s*from\\s*["']${moduleName}["'];`;
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(importRegex);
        if (match) {
            return { line: i };
        }
    }
    return null; // No existing import for the module
}
// Helper function to find which range ends later
function findLastRange(r1, r2) {
    if (r1.end.line > r2.end.line)
        return r1;
    if (r1.end.line < r2.end.line)
        return r2;
    if (r1.end.character < r2.end.character)
        return r2;
    return r1;
}
//# sourceMappingURL=utils.js.map