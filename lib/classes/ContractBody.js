import { Clause } from './Clause';
import { Serializer } from './Serializer';

export class ContractBody {
    constructor (body, options = {}) {
        this.init(body, options);
    }

    init (body, options = {}) {
        this.type = options.type || null;

        if (body instanceof Clause) {
            this.type = 'clause';
            this.clause = body;
        } else if (typeof body === 'string') {
            this.type = 'fnString';
            this.fnString = body;
            this.language = options.language || 'es5';
            this.fn = Serializer.deserializeFunction(body, this.language);
        } else if (typeof body === 'function') {
            this.type = 'fn';
            this.fn = body;
            this.language = options.language || 'es5';
        } else if (typeof body === 'object') {
            this.init(body[body.type], body);
        }
    }

    async eval (contract) {
        if (this.clause instanceof Clause) {
            let ans = await this.clause.eval();
            this.clause.clearMemo();
            return ans;
        }
        else
            return await contract.runInSandbox(this.fn);
    }

    toJSON () {
        console.log(this);
        let obj;
        if (this.type === 'clause') {
            obj = {
                type: 'clause',
                clause: this.clause
            };
        } else {
            obj = {
                type: 'fnString',
                fnString: this.fnString || this.fn.toString(),
                language: this.language
            };
        }
        console.log(obj);
        return obj;
    }
}