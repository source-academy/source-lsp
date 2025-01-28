"use strict";
const MODULE_LIST_URL = "https://raw.githubusercontent.com/source-academy/modules/refs/heads/master/modules.json";
fetch(MODULE_LIST_URL).then(res => {
    res.json().then(data => {
        console.log(Object.keys(data));
    });
});
//# sourceMappingURL=build_docs.js.map