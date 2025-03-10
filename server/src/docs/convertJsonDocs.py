import json
from markdownify import markdownify as md
import re

if __name__ == "__main__":
    patches = json.loads(open("patches.json").read())

    with open("source.json", "w") as f:
        res = []
        for chapter in [f"source_{i}.json" for i in range(1, 5)]:
            curr = []
            for key, val in json.loads(open(chapter).read()).items():
                item = {
                    "label": key,
                    "title": val["title"],
                    "description": md(val["description"])[1:-1],
                    "meta": val["meta"],
                }

                if item["meta"] == "func":
                    params = re.findall(r"\w+\(([^)]*)\)", val["title"])[0]

                    if len(params) != 0:
                        item["parameters"] = (
                            patches["rename_params"][key]
                            if key in patches["rename_params"]
                            else [param.strip() for param in params.split(",")]
                        )
                    else:
                        item["parameters"] = []

                if key in patches["optional_params"]:
                    item["optional_params"] = patches["optional_params"][key]

                if key in patches["hasRestElement"]:
                    item["hasRestElement"] = True

                curr.append(item)

            res.append(curr)

        json.dump(res, f)
