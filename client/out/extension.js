"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = require("path");
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
const vscode_2 = require("vscode");
let client;
function activate(context) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
        }
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'sourcejs' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    // Create the language client and start the client.
    client = new node_1.LanguageClient('languageServerExample', 'Language Server Example', serverOptions, clientOptions);
    // Start the client. This will also launch the server
    client.start();
    context.subscriptions.push(vscode_2.commands.registerCommand("sourcejs.setLanguageVersion", async () => {
        const versions = ["Source 1", "Source 2", "Source 3", "Source 4"];
        const selectedVersion = await vscode_2.window.showQuickPick(versions, {
            placeHolder: "Select the language version",
        });
        if (selectedVersion) {
            await setLanguageVersion(versions.indexOf(selectedVersion) + 1);
        }
    }));
}
// Function to send the version to the server
async function setLanguageVersion(version) {
    if (!client) {
        vscode_2.window.showErrorMessage("Language server is not running.");
        return;
    }
    try {
        const response = await client.sendRequest("setLanguageVersion", { version });
        vscode_2.window.showInformationMessage(`Language version set to ${version}`);
    }
    catch (error) {
        vscode_2.window.showErrorMessage(`Failed to set language version: ${error}`);
    }
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
//# sourceMappingURL=extension.js.map