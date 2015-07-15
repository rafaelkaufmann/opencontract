import { ContractBody } from './ContractBody';
import { Contract } from './Contract';
import { State } from './State';
import { Query } from './Query';
import { Clause } from './Clause';
import { Party } from './Party';

var _ = require('lodash'),
    babel = require('babel');

export class Serializer {
    static serialize(obj, filters) {

        return JSON.stringify(obj, function (key, value) {
            if (filters[key] === false)
                return undefined;

            if (value instanceof ContractBody)
                return JSON.stringify(value.toJSON());

            if (typeof value === 'function')
                return value.toString();

            return value;
        });
    }

    static deserialize(data) {
        let obj = JSON.parse(data);

        if (obj.isExpired) obj.isExpired = Serializer.deserializeFunction(obj.isExpired);
        if (obj.isRevoked) obj.isRevoked = Serializer.deserializeFunction(obj.isRevoked);
        if (obj.body) obj.body = new ContractBody(obj.body);

        obj.parties = _.mapValues(obj.parties, (party) => new Party(party));
        obj.signatures = _.mapValues(obj.signatures, (sig) => new Buffer(sig));

        return new Contract(obj);
    }

    static deserializeFunction (fnString, language = 'es5') { // TODO: Make this safer. Investigate using `dslify`
        return getDeserializeStrategy(language).deserialize(fnString);
    }
}

function getDeserializeStrategy (language) {  // we have to do it like this because ES6 classes are not hoisted
    switch (language) {
        case 'es5':
            return new ES5FunctionDeserializeStrategy();
        case 'es7':
            return new ES7FunctionDeserializeStrategy();
    }
}

class FunctionDeserializeStrategy {
}

class ES5FunctionDeserializeStrategy extends FunctionDeserializeStrategy {
    deserialize (fnString) {
        let _this = this,
            _libOc = {Contract, State, Clause};  // Obviously this is evil, makes use of Babel transpilation convention
        let fn;

        let code = `fn = ${fnString}`;
        eval(code);
        return fn;
    }
}

class ES7FunctionDeserializeStrategy extends FunctionDeserializeStrategy {
    deserialize (fnString) {
        let _this = this,
            _libOc = {Contract, State, Clause};  // Obviously this is evil, makes use of Babel transpilation convention
        let fn;

        let modulesHeader = _.map(_.keys(_libOc), key => `${key} = _libOc.${key}`).join(', ');

        let code = `let ${modulesHeader};
                    fn = ${fnString}`;

        let compiled = babel.transform(code, {stage: 1});

        eval(compiled.code);
        return fn;
    }
}