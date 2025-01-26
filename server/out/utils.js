"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodeChildren = getNodeChildren;
exports.getSubstrFromSouceLoc = getSubstrFromSouceLoc;
exports.sourceLocToRange = sourceLocToRange;
exports.mapDeclarationKindToSymbolKind = mapDeclarationKindToSymbolKind;
exports.getAllNames = getAllNames;
const vscode_languageserver_1 = require("vscode-languageserver");
const name_extractor_1 = require("js-slang/dist/name-extractor");
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
function mapDeclarationKindToSymbolKind(kind) {
    switch (kind) {
        case name_extractor_1.DeclarationKind.KIND_IMPORT:
            return vscode_languageserver_1.SymbolKind.Namespace;
        case name_extractor_1.DeclarationKind.KIND_FUNCTION:
            return vscode_languageserver_1.SymbolKind.Function;
        case name_extractor_1.DeclarationKind.KIND_LET:
        case name_extractor_1.DeclarationKind.KIND_PARAM:
            return vscode_languageserver_1.SymbolKind.Variable;
        case name_extractor_1.DeclarationKind.KIND_CONST:
            return vscode_languageserver_1.SymbolKind.Constant;
        default:
            return vscode_languageserver_1.SymbolKind.Namespace;
    }
}
// The getNames function in js-slang has some issues, firstly it only get the names within a given scope, and it doesnt return the location of the name
// This implementation doesn't care where the cursor is, and grabs the name of all variables and functions
// @param prog Root node of the program, generated using looseParse
// @returns ProgramSymbols[]
async function getAllNames(prog) {
    const queue = [prog];
    const symbols = [];
    while (queue.length > 0) {
        const node = queue.shift();
        if (node.type == "VariableDeclaration") {
            node.declarations.map(declaration => symbols.push({
                // We know that x is a variable declarator
                // @ts-ignore
                name: declaration.id.name,
                kind: node.kind === 'var' || node.kind === 'let' ? name_extractor_1.DeclarationKind.KIND_LET : name_extractor_1.DeclarationKind.KIND_CONST,
                range: sourceLocToRange(declaration.loc),
                selectionRange: sourceLocToRange(declaration.id.loc)
            }));
        }
        if (node.type == "FunctionDeclaration") {
            symbols.push({
                name: node.id.name,
                kind: name_extractor_1.DeclarationKind.KIND_FUNCTION,
                range: sourceLocToRange(node.loc),
                selectionRange: sourceLocToRange(node.id.loc)
            });
            node.params.map(param => symbols.push({
                // @ts-ignore
                name: param.name,
                kind: name_extractor_1.DeclarationKind.KIND_PARAM,
                range: sourceLocToRange(param.loc),
                selectionRange: sourceLocToRange(param.loc)
            }));
        }
        queue.push(...getNodeChildren(node));
    }
    return symbols;
}
//# sourceMappingURL=utils.js.map