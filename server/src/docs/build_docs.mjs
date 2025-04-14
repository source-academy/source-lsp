// @ts-check

import fs from 'fs/promises';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import patches from "./patches.json" with { type: "json" };

const CONST_DECL = "const";
const FUNC_DECL = "func";

const BASE_URL = "https://docs.sourceacademy.org"
const SRC_FILENAME = "global.html"

const TARGETS = [
  "source_1",
  "source_2",
  "source_3",
  "source_4",
]

const FINAL_TARGET = "source";

const turndownService = new TurndownService();

function newTitleNode(title, document) {
  const node = document.createElement('h4');
  const text = document.createTextNode(title);
  node.appendChild(text);
  return node;
}

function buildDescriptionMarkdown(div) {
  return turndownService.turndown(div.outerHTML.replace('/\n+/', '\n'));
}

function processConstant(names, element, document) {
  const header = element.getElementsByTagName('h4')[0];
  const rawName = header.textContent;
  const fields = rawName.split(' ').slice(1)

  let title = fields.join('');
  const name = header.getAttribute('id');
  if (!title) {
    title = name;
  }

  const titleNode = newTitleNode(title, document);
  const descriptionNode = element.getElementsByClassName('description')[0];

  const descriptionDiv = document.createElement('div');
  descriptionDiv.appendChild(titleNode);
  descriptionDiv.appendChild(descriptionNode);

  let markdown = buildDescriptionMarkdown(descriptionDiv);
  const lines = markdown.split("\n");
  lines.unshift("```source");
  lines[1] = lines[1].substring(5);
  lines.splice(2, 0, "```");
  markdown = lines.join("\n");

  names.push({ label: name, title, description: markdown, meta: CONST_DECL });
}

function processFunction(names, element, document) {
  const header = element.getElementsByTagName('h4')[0];
  const title = header.textContent;
  const name = header.getAttribute('id');

  const titleNode = newTitleNode(title, document);
  const descriptionNode = element.getElementsByClassName('description')[0];

  const descriptionDiv = document.createElement('div');
  descriptionDiv.appendChild(titleNode);
  descriptionDiv.appendChild(descriptionNode);

  let markdown = buildDescriptionMarkdown(descriptionDiv);
  const lines = markdown.split("\n");
  lines.unshift("```source");
  lines[1] = lines[1].substring(5);
  lines.splice(2, 0, "```");
  markdown = lines.join("\n");

  const params = (Object.keys(patches["rename_params"])).includes(name) ? patches["rename_params"][name] : [...title.matchAll(/\w+\(([^)]*)\)/g)][0][1].split(",").map(s => s.trim());
  const autocomplete = { label: name, title, description: markdown, meta: FUNC_DECL, parameters: params[0] === '' ? [] : params };

  if (Object.keys(patches["optional_params"]).includes(name))
    autocomplete["optional_params"] = patches["optional_params"][name];
  if (patches["hasRestElement"].includes(name))
    autocomplete["hasRestElement"] = true;


  names.push(autocomplete);
}

async function processDirGlobals(global, target, index) {
  const url = `${BASE_URL}/${target}/${SRC_FILENAME}`;
  let document;
  try {
    const contents = await (await fetch(url)).text();
    document = new JSDOM(contents.toString()).window.document;
  } catch (err) {
    console.error(url, "failed", err);
    return err;
  }

  const names = [];

  const constants = document.getElementsByClassName("constant-entry");
  Array.prototype.forEach.call(constants, ele => processConstant(names, ele, document));

  const functions = document.getElementsByClassName('function-entry')
  Array.prototype.forEach.call(functions, ele => processFunction(names, ele, document));

  global[index] = (names);
  return undefined
}

console.log('Building built in autocomplete documentation')

const global = [];
// Exit with error code if the there was some error
const errors = await Promise.all(TARGETS.map((x, i) => processDirGlobals(global, x, i)));
if (errors.find(each => each !== undefined)) process.exit(1);
await fs.writeFile(FINAL_TARGET + '.json', JSON.stringify(global, null, 2), 'utf-8')

console.log('Finished processing built in autocomplete documentation')

console.log('Building modules autocomplete documentation')

const MODULE_LIST_URL = "https://raw.githubusercontent.com/source-academy/modules/refs/heads/master/modules.json";
const MODULE_DOCS_URL = "https://source-academy.github.io/modules/jsons";
const OUTFILE = "modules.json";

const names = Object.keys(await (await fetch(MODULE_LIST_URL)).json())
const modules = {}

function mapKindToMeta(kind) {
  switch (kind) {
    case "variable":
      return "const";
    case "function":
      return "func";
    default:
      return "const";
  }
}

async function buildDoc(name) {
  const doc = await (await fetch(`${MODULE_DOCS_URL}/${name}.json`)).json();
  const module = {};
  for (const key in doc) {
    const item = {
      "label": key,
      meta: mapKindToMeta(doc[key]["kind"]),
      title: `Auto-import from ${name}`,
      description: ""
    };

    if (doc[key]["kind"] === "variable")
      item["description"] = `#### ${key}:${doc[key]['type']}\n${turndownService.turndown(doc[key]["description"])}`;
    else if (doc[key]["kind"] === "function") {
      const params = doc[key]['params'].map(x => x[0]);
      item["description"] = `\`\`\`source\n${key}(${params.join(', ')}) → ${doc[key]['retType']}\n\`\`\`\n${turndownService.turndown(doc[key]["description"])}`;
      item["parameters"] = params
    }

    module[key] = item;
  }

  return module;
}

for (const name of names) {
  modules[name] = await buildDoc(name);
}

await fs.writeFile(OUTFILE, JSON.stringify(modules, null, 2), 'utf-8')

console.log('Finished processing modules autocomplete documentation')
