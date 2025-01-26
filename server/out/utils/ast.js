"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodeChildren = getNodeChildren;
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
//# sourceMappingURL=ast.js.map