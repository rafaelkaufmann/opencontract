import { Oracle } from './Oracle';

export class Query {
    constructor (oracleURI, query) {
        this.oracleURI = oracleURI;
        this.query = query;
        this.memo = null;
    }

    async run() {
        let ans;
        if (this.memo) {
            ans = this.memo;
        } else {
            ans = await Oracle.fetchAndQuery(this.oracleURI, this.query);
            this.memo = ans;
        }

        return ans;
    }
}