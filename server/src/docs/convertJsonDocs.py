import json
from markdownify import markdownify as md
import re

if __name__ == "__main__":
    patches = json.loads(open("patches.json").read())

    with open("source.json", "w") as f:
        # one liner :)
        json.dump(
            [
                [
                    [
                        item := {
                            "label": key,
                            "title": val["title"],
                            "description": md(val["description"])[1:-1],
                            "meta": val["meta"],
                        },
                        item.update(
                            {
                                "parameters": (
                                    patches["rename_params"][key]
                                    if key in patches["rename_params"]
                                    else [param.strip() for param in params.split(",")]
                                )
                                if len(
                                    params := re.findall(
                                        r"\w+\(([^)]*)\)", val["title"]
                                    )[0]
                                )
                                != 0
                                else []
                            }
                        )
                        if item["meta"] == "func"
                        else 0,
                        item.update(
                            {"optional_params": patches["optional_params"][key]}
                        )
                        if key in patches["optional_params"]
                        else 0,
                    ][0]
                    for key, val in json.loads(open(i).read()).items()
                ]
                for i in [f"source_{i}.json" for i in range(1, 5)]
            ],
            f,
        )
