"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const source_json_1 = __importDefault(require("../docs/source.json"));
const js_slang_1 = require("js-slang");
const types_1 = require("js-slang/dist/types");
const utils_1 = require("js-slang/dist/parser/utils");
const utils_2 = require("./utils");
const name_extractor_1 = require("js-slang/dist/name-extractor");
const autocomplete_labels = source_json_1.default.map(version => version.map((doc, idx) => {
    return {
        label: doc.label,
        labelDetails: { detail: ` (${doc.meta})` },
        kind: node_1.CompletionItemKind.Text,
        data: idx
    };
}));
const chapter_names = {
    "Source 1": types_1.Chapter.SOURCE_1,
    "Source 2": types_1.Chapter.SOURCE_2,
    "Source 3": types_1.Chapter.SOURCE_3,
    "Source 4": types_1.Chapter.SOURCE_4
};
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager.
let documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let source_version = 1;
connection.onInitialize((params) => {
    let capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true
            },
            declarationProvider: true,
            documentHighlightProvider: true,
            documentSymbolProvider: true,
            renameProvider: true
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;
// Cache the settings of all open documents
let documentSettings = new Map();
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.languageServerExample || defaultSettings));
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'languageServerExample'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
// Custom request to set the language version
connection.onRequest("setLanguageVersion", (params) => {
    source_version = chapter_names[params.version];
    connection.console.log(`Set language version to ${params.version}`);
    return { success: true };
});
// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
async function validateTextDocument(textDocument) {
    // In this simple example we get the settings for every validate run.
    let settings = await getDocumentSettings(textDocument.uri);
    // The validator creates diagnostics for all uppercase words length 2 and more
    let text = textDocument.getText();
    let pattern = /\b[A-Z]{2,}\b/g;
    let m;
    let problems = 0;
    let diagnostics = [];
    while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
        problems++;
        let diagnostic = {
            severity: node_1.DiagnosticSeverity.Warning,
            range: {
                start: textDocument.positionAt(m.index),
                end: textDocument.positionAt(m.index + m[0].length)
            },
            message: `${m[0]} is all uppercase.`,
            source: 'ex'
        };
        if (hasDiagnosticRelatedInformationCapability) {
            diagnostic.relatedInformation = [
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnostic.range)
                    },
                    message: source_version + ''
                }
            ];
        }
        diagnostics.push(diagnostic);
    }
    // Send the computed diagnostics to VS Code.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VS Code
    connection.console.log('We received a file change event');
});
// This handler provides the initial list of the completion items.
connection.onCompletion(async (textDocumentPosition) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document)
        return [];
    const text = document.getText();
    const pos = textDocumentPosition.position;
    const [program, comments] = (0, utils_1.parseWithComments)(text);
    const [names, _success] = await (0, name_extractor_1.getProgramNames)(program, comments, { line: pos.line + 1, column: pos.character });
    const new_labels = names.map((name, idx) => ({
        label: name.name,
        labelDetails: { detail: ` (${name.meta})` },
        kind: node_1.CompletionItemKind.Text,
        data: autocomplete_labels[source_version - 1].length + idx
    }));
    return autocomplete_labels[source_version - 1].concat(new_labels);
});
// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    if (item.data < source_json_1.default[source_version - 1].length) {
        const doc = source_json_1.default[source_version - 1][item.data];
        item.detail = doc.title;
        item.documentation = {
            kind: node_1.MarkupKind.Markdown,
            value: doc.description
        };
        if (doc.meta === "func") {
            item.insertText = `${item.label}(${doc.parameters})`;
            item.insertTextFormat = node_1.InsertTextFormat.Snippet;
        }
    }
    return item;
});
// This handler provides the declaration location of the name at the location provided
connection.onDeclaration(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const text = document.getText();
    const position = params.position;
    const loc = {
        line: position.line + 1,
        column: position.character
    };
    const context = (0, js_slang_1.createContext)(source_version, types_1.Variant.DEFAULT);
    const result = (0, js_slang_1.findDeclaration)(text, context, loc);
    if (result) {
        const range = (0, utils_2.sourceLocToRange)(result);
        return {
            uri: params.textDocument.uri,
            range
        };
    }
    else {
        return null;
    }
});
connection.onDocumentHighlight((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const text = document.getText();
    const position = params.position;
    const occurences = (0, js_slang_1.getAllOccurrencesInScope)(text, (0, js_slang_1.createContext)(source_version, types_1.Variant.DEFAULT), { line: position.line + 1, column: position.character });
    return occurences.map(loc => ({
        range: (0, utils_2.sourceLocToRange)(loc)
    }));
});
connection.onDocumentSymbol(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const text = document.getText();
    const names = await (0, utils_2.getAllNames)((0, utils_1.looseParse)(text, (0, js_slang_1.createContext)(source_version, types_1.Variant.DEFAULT)));
    return names.map(name => ({
        ...name,
        kind: (0, utils_2.mapDeclarationKindToSymbolKind)(name.kind)
    }));
});
connection.onRenameRequest((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const text = document.getText();
    const position = params.position;
    const occurences = (0, js_slang_1.getAllOccurrencesInScope)(text, (0, js_slang_1.createContext)(source_version, types_1.Variant.DEFAULT), { line: position.line + 1, column: position.character });
    if (occurences.length === 0) {
        return null;
    }
    return {
        changes: {
            [params.textDocument.uri]: occurences.map(loc => node_1.TextEdit.replace((0, utils_2.sourceLocToRange)(loc), params.newName))
        }
    };
});
// Make the text document manager listen on the connection
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map