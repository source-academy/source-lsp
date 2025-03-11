import requests
import json
from markdownify import markdownify as md

MODULE_LIST_URL = "https://raw.githubusercontent.com/source-academy/modules/refs/heads/master/modules.json"
MODULE_DOCS_URL = "https://source-academy.github.io/modules/jsons"

module_list = requests.get(MODULE_LIST_URL).json().keys()
modules = {}
kind_to_meta_map = {"variable": "const", "function": "func", "unknown": "const"}

for module_name in module_list:
    module = requests.get(f"{MODULE_DOCS_URL}/{module_name}.json").json()
    print(module_name)
    modules[module_name] = {}
    for k in module:
        modules[module_name][k] = {
            "label": k,
            "meta": kind_to_meta_map[module[k]["kind"]],
            "title": f"Auto-import from {module_name}",
            "description": (
                "#### "
                + (
                    f"{k}:{module[k]['type']}"
                    if module[k]["kind"] == "variable"
                    else f"{k}({', '.join([i[0] for i in module[k]['params']])}) → {module[k]['retType']}"
                    if module[k]["kind"] == "function"
                    else ""
                )
                + "\n"
                + md(module[k]["description"]).strip()
            )
            if module[k]["kind"] != "unknown"
            else "",
        }

        if module[k]["kind"] == "function":
            modules[module_name][k]["parameters"] = [v[0] for v in module[k]["params"]]

with open("modules.json", "w") as f:
    json.dump(modules, f)
