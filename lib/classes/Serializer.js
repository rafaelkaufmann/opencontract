import { ContractBody } from './ContractBody';
import { Contract } from './Contract';
import { State, UnitState, JointState } from './State';
import { Query } from './Query';
import { Party } from './Party';

let _ = require('lodash'),
    babel = require('babel');

let plugins = {};

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
        let Strategy = Serializer.getDeserializeStrategy(language),
            strategy = new Strategy();
        return strategy.deserialize(fnString);
    }

    static getDeserializeStrategy (language) {
        let plugin = Serializer.getPlugin(language);
        if (!plugin)
            throw new Error(`No plugin for language ${language}`);

        if (!plugin.deserializeStrategy)
            throw new Error(`Malformed plugin for language ${language}`);

        return plugin.deserializeStrategy;
    }

    static addPlugin (plugin) {
        plugins[plugin.name] = plugin;
    }

    static getPlugin (language) {
        return plugins[language];
    }
}

export class LanguagePlugin {
    constructor (params) {
        this.name = params.name;
        this.deserializeStrategy = params.deserializeStrategy;
    }
}

export class FunctionDeserializeStrategy {
}

class ES5FunctionDeserializeStrategy extends FunctionDeserializeStrategy {
    deserialize (fnString) {
        let _this = this,
            _libOc = {Contract, State, UnitState, JointState};  // Obviously this is evil, makes use of Babel transpilation convention
        let fn;

        let code = `fn = ${fnString}`;
        eval(code);
        return fn;
    }
}

class ES7FunctionDeserializeStrategy extends FunctionDeserializeStrategy {
    deserialize (fnString) {
        let _this = this,
            _libOc = {Contract, State, UnitState, JointState};  // Obviously this is evil, makes use of Babel transpilation convention
        let fn;

        let modulesHeader = _.map(_.keys(_libOc), key => `${key} = _libOc.${key}`).join(', ');

        let code = `let ${modulesHeader};
                    fn = ${fnString}`;

        let compiled = babel.transform(code, {stage: 1});

        eval(compiled.code);
        return fn;
    }
}

Serializer.addPlugin(new LanguagePlugin({ name: 'es5', deserializeStrategy: ES5FunctionDeserializeStrategy }));
Serializer.addPlugin(new LanguagePlugin({ name: 'es7', deserializeStrategy: ES7FunctionDeserializeStrategy }));