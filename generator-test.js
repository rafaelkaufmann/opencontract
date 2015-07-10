var babel = require('babel');

var code = 'async function foo() { \
    await 1; \
}';

var v1 = babel.transform(code, { optional: ["asyncToGenerator"] }),
    v2 = babel.transform(code, { optional: ["bluebirdCoroutines"] });

console.log(v1.code);
console.log(v2.code);
